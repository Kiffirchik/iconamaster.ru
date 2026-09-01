[CmdletBinding()]
param(
    [switch]$CheckOnly,
    [switch]$InstallPrerequisites,
    [switch]$ForDeployment,
    [switch]$ForMigration
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:IconamasterProjectRoot = $PSScriptRoot

function ConvertTo-SetupVersion {
    param([Parameter(Mandatory)][string]$Value)

    $clean = $Value.Trim() -replace '^[^0-9]*', ''
    $match = [regex]::Match($clean, '^(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)')
    if (-not $match.Success) {
        throw "Cannot parse semantic version: $Value"
    }

    return [version]::new(
        [int]$match.Groups['major'].Value,
        [int]$match.Groups['minor'].Value,
        [int]$match.Groups['patch'].Value
    )
}

function Test-NodeVersionPolicy {
    param([Parameter(Mandatory)][string]$Value)

    $version = ConvertTo-SetupVersion $Value
    if ($version.Major -eq 20) {
        return $version -ge [version]'20.19.0'
    }
    if ($version.Major -eq 21) {
        return $false
    }
    if ($version.Major -eq 22) {
        return $version -ge [version]'22.12.0'
    }
    return $version.Major -gt 22
}

function Test-NpmVersionPolicy {
    param([Parameter(Mandatory)][string]$Value)

    return (ConvertTo-SetupVersion $Value).Major -ge 10
}

function Resolve-SetupCommand {
    param([Parameter(Mandatory)][string]$Name)

    return Get-Command $Name -ErrorAction SilentlyContinue
}

function Invoke-SetupCommand {
    param(
        [Parameter(Mandatory)][string]$File,
        [string[]]$Arguments = @()
    )

    & $File @Arguments
    return $LASTEXITCODE
}

function Invoke-SetupCommandResult {
    param(
        [Parameter(Mandatory)][scriptblock]$Runner,
        [Parameter(Mandatory)][string]$File,
        [string[]]$Arguments = @()
    )

    $items = @(& $Runner $File $Arguments)
    $exitCode = 0
    $output = @()
    if ($items.Count -gt 0 -and $items[-1] -is [int]) {
        $exitCode = [int]$items[-1]
        if ($items.Count -gt 1) {
            $output = @($items[0..($items.Count - 2)])
        }
    } else {
        $output = $items
    }

    return [pscustomobject]@{
        ExitCode = $exitCode
        Output = $output
    }
}

function Get-SetupCommandSource {
    param(
        [Parameter(Mandatory)]$Command,
        [Parameter(Mandatory)][string]$Fallback
    )

    $sourceProperty = $Command.PSObject.Properties['Source']
    if ($null -ne $sourceProperty -and -not [string]::IsNullOrWhiteSpace([string]$sourceProperty.Value)) {
        return [string]$sourceProperty.Value
    }
    return $Fallback
}

function Get-CoreToolchainState {
    param(
        [scriptblock]$Resolver,
        [scriptblock]$Runner
    )

    if ($null -eq $Resolver) {
        $Resolver = { param($Name) Resolve-SetupCommand $Name }
    }
    if ($null -eq $Runner) {
        $Runner = { param($File, $Arguments) Invoke-SetupCommand -File $File -Arguments $Arguments }
    }

    $tools = @(
        [pscustomobject]@{ Name = 'git'; Required = 'installed' },
        [pscustomobject]@{ Name = 'node'; Required = '^20.19.0 || >=22.12.0' },
        [pscustomobject]@{ Name = 'npm'; Required = '>=10' }
    )

    foreach ($tool in $tools) {
        $command = & $Resolver $tool.Name
        $found = $null
        $ready = $false
        $source = $tool.Name

        if ($null -ne $command) {
            $source = Get-SetupCommandSource -Command $command -Fallback $tool.Name
            $result = Invoke-SetupCommandResult -Runner $Runner -File $source -Arguments @('--version')
            $foundLine = @($result.Output | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } | Select-Object -First 1)
            if ($foundLine.Count -gt 0) {
                $found = ([string]$foundLine[0]).Trim()
            }

            if ($result.ExitCode -eq 0 -and $null -ne $found) {
                try {
                    switch ($tool.Name) {
                        'git' { $ready = $true }
                        'node' { $ready = Test-NodeVersionPolicy $found }
                        'npm' { $ready = Test-NpmVersionPolicy $found }
                    }
                } catch {
                    $ready = $false
                }
            }
        }

        [pscustomobject]@{
            Name = $tool.Name
            Ready = $ready
            Found = $found
            Required = $tool.Required
            Command = $source
        }
    }
}

function Get-DeploymentToolState {
    param([scriptblock]$Resolver)

    if ($null -eq $Resolver) {
        $Resolver = { param($Name) Resolve-SetupCommand $Name }
    }

    foreach ($name in @('ssh', 'scp', 'tar')) {
        $command = & $Resolver $name
        $found = $null
        if ($null -ne $command) {
            $found = Get-SetupCommandSource -Command $command -Fallback $name
        }

        [pscustomobject]@{
            Name = $name
            Ready = $null -ne $command
            Found = $found
            Required = 'installed'
        }
    }
}

function Compare-FfmpegIdentity {
    param(
        [Parameter(Mandatory)]$Expected,
        [Parameter(Mandatory)]$Actual
    )

    $expectedHash = ([string]$Expected.binarySha256).ToLowerInvariant()
    $actualHash = ([string]$Actual.binarySha256).ToLowerInvariant()
    $reasons = @()
    if ($expectedHash -cne $actualHash) {
        $reasons += 'checksum'
    }
    if ([string]$Expected.versionLine -cne [string]$Actual.versionLine) {
        $reasons += 'version'
    }

    return [pscustomobject]@{
        Ready = $reasons.Count -eq 0
        Reasons = $reasons
    }
}

function Test-MigrationToolchain {
    param(
        [scriptblock]$Resolver,
        [scriptblock]$Runner
    )

    if ($null -eq $Resolver) {
        $Resolver = { param($Name) Resolve-SetupCommand $Name }
    }
    if ($null -eq $Runner) {
        $Runner = { param($File, $Arguments) Invoke-SetupCommand -File $File -Arguments $Arguments }
    }

    $fixtureReference = 'tests/fixtures/migration/editorial-cover-assets.json'
    $fixturePath = Join-Path $script:IconamasterProjectRoot $fixtureReference
    try {
        $fixtureJson = Get-Content -Raw -LiteralPath $fixturePath
    } catch {
        return [pscustomobject]@{
            Ready = $false
            Fixture = $fixtureReference
            Reasons = @('fixture-read')
        }
    }
    try {
        $fixture = $fixtureJson | ConvertFrom-Json
        $expected = $fixture.encoder
        if ([string]::IsNullOrWhiteSpace([string]$expected.binarySha256) -or
            [string]::IsNullOrWhiteSpace([string]$expected.versionLine)) {
            throw 'Invalid migration encoder fixture.'
        }
    } catch {
        return [pscustomobject]@{
            Ready = $false
            Fixture = $fixtureReference
            Reasons = @('fixture-parse')
        }
    }
    try {
        $command = & $Resolver 'ffmpeg'
    } catch {
        return [pscustomobject]@{
            Ready = $false
            Fixture = $fixtureReference
            Reasons = @('resolve')
        }
    }
    if ($null -eq $command) {
        return [pscustomobject]@{
            Ready = $false
            Fixture = $fixtureReference
            Reasons = @('missing')
        }
    }

    try {
        $source = Get-SetupCommandSource -Command $command -Fallback 'ffmpeg'
        if ($null -eq (Get-Command Get-FileHash -ErrorAction SilentlyContinue)) {
            $utilityModule = Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Utility/Microsoft.PowerShell.Utility.psd1'
            Import-Module -Name $utilityModule -Force
        }
        $hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
    } catch {
        return [pscustomobject]@{
            Ready = $false
            Fixture = $fixtureReference
            Reasons = @('hash')
        }
    }
    try {
        $result = Invoke-SetupCommandResult -Runner $Runner -File $source -Arguments @('-version')
    } catch {
        return [pscustomobject]@{
            Ready = $false
            Fixture = $fixtureReference
            Reasons = @('version-command')
        }
    }
    $versionLine = $null
    if ($result.Output.Count -gt 0) {
        $versionLine = [string]$result.Output[0]
    }
    $actual = [pscustomobject]@{
        binarySha256 = $hash
        versionLine = $versionLine
    }
    $comparison = Compare-FfmpegIdentity -Expected $expected -Actual $actual
    $reasons = @($comparison.Reasons)
    if ($result.ExitCode -ne 0) {
        $reasons = @('version-command') + $reasons
    }

    return [pscustomobject]@{
        Ready = $result.ExitCode -eq 0 -and $comparison.Ready
        Fixture = $fixtureReference
        Reasons = $reasons
    }
}

function Install-CorePrerequisites {
    param(
        [Parameter(Mandatory)][object[]]$State,
        [scriptblock]$Runner,
        [scriptblock]$Resolver,
        [switch]$Enabled
    )

    if (-not $Enabled) {
        throw 'Prerequisite installation requires -InstallPrerequisites.'
    }
    if ($null -eq $Resolver) {
        $Resolver = { param($Name) Resolve-SetupCommand $Name }
    }
    if ($null -eq $Runner) {
        $Runner = { param($File, $Arguments) Invoke-SetupCommand -File $File -Arguments $Arguments }
    }

    $missing = @($State | Where-Object { -not $_.Ready })
    if ($missing.Count -eq 0) {
        return
    }

    $wingetCommand = & $Resolver 'winget'
    if ($null -eq $wingetCommand) {
        throw 'winget is unavailable. Action: install or update Microsoft App Installer, reopen the shell, then run .\setup.ps1 -CheckOnly'
    }
    $winget = Get-SetupCommandSource -Command $wingetCommand -Fallback 'winget'
    $packageIds = @{ git = 'Git.Git'; node = 'OpenJS.NodeJS.LTS'; npm = 'OpenJS.NodeJS.LTS' }
    $selectedIds = @()
    foreach ($item in $missing) {
        $packageId = $packageIds[[string]$item.Name]
        if ($null -eq $packageId) {
            throw "No winget package is declared for $($item.Name)."
        }
        if ($selectedIds -notcontains $packageId) {
            $selectedIds += $packageId
        }
    }

    foreach ($packageId in $selectedIds) {
        $arguments = @(
            'install', '--exact', '--id', $packageId,
            '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'
        )
        $result = Invoke-SetupCommandResult -Runner $Runner -File $winget -Arguments $arguments
        if ($result.ExitCode -ne 0) {
            throw "winget failed for $packageId with exit code $($result.ExitCode)."
        }
    }

    $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machinePath, $userPath) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ';'
}

function Test-ProjectMetadata {
    param([string]$Root = $script:IconamasterProjectRoot)

    $packagePath = Join-Path $Root 'package.json'
    $lockPath = Join-Path $Root 'package-lock.json'
    if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
        throw "Missing project metadata: $packagePath"
    }
    if (-not (Test-Path -LiteralPath $lockPath -PathType Leaf)) {
        throw "Missing project metadata: $lockPath"
    }

    $packageJson = Get-Content -Raw -LiteralPath $packagePath
    $lockJson = Get-Content -Raw -LiteralPath $lockPath
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $package = $packageJson | ConvertFrom-Json -AsHashtable
        $lock = $lockJson | ConvertFrom-Json -AsHashtable
    } else {
        Add-Type -AssemblyName System.Web.Extensions
        $serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
        $package = $serializer.DeserializeObject($packageJson)
        $lock = $serializer.DeserializeObject($lockJson)
    }
    $rootPackage = $lock['packages']['']
    if ($null -eq $rootPackage) {
        throw 'package-lock.json is missing its root package metadata.'
    }

    $packageName = [string]$package['name']
    if ([string]::IsNullOrWhiteSpace($packageName)) {
        throw 'package.json must declare a project name.'
    }
    if ($lock['name'] -ne $packageName -or $rootPackage['name'] -ne $packageName) {
        throw 'package.json and package-lock.json root names must match.'
    }
    if ([int]$lock['lockfileVersion'] -ne 3) {
        throw 'package-lock.json must use lockfileVersion 3.'
    }
}

function Write-CoreToolchainState {
    param([Parameter(Mandatory)][object[]]$State)

    foreach ($item in $State) {
        $found = $item.Found
        if ([string]::IsNullOrWhiteSpace([string]$found)) {
            $found = 'not found'
        }
        Write-Host "$($item.Name): $found (required: $($item.Required))"
    }
}

function Invoke-SetupStep {
    param(
        [Parameter(Mandatory)][scriptblock]$Runner,
        [Parameter(Mandatory)][string]$File,
        [string[]]$Arguments = @()
    )

    $result = Invoke-SetupCommandResult -Runner $Runner -File $File -Arguments $Arguments
    foreach ($line in $result.Output) {
        Write-Host $line
    }
    return [int]$result.ExitCode
}

function Invoke-IconamasterSetup {
    param(
        [switch]$CheckOnly,
        [switch]$InstallPrerequisites,
        [switch]$ForDeployment,
        [switch]$ForMigration,
        [string]$ProjectRoot = $script:IconamasterProjectRoot,
        [scriptblock]$Resolver,
        [scriptblock]$Runner
    )

    if ($CheckOnly -and $InstallPrerequisites) {
        throw '-CheckOnly and -InstallPrerequisites cannot be used together.'
    }
    if ($env:OS -ne 'Windows_NT') {
        throw 'Iconamaster setup requires Windows.'
    }
    if ($null -eq $Resolver) {
        $Resolver = { param($Name) Resolve-SetupCommand $Name }
    }
    if ($null -eq $Runner) {
        $Runner = { param($File, $Arguments) Invoke-SetupCommand -File $File -Arguments $Arguments }
    }

    $state = @(Get-CoreToolchainState -Resolver $Resolver -Runner $Runner)
    Write-CoreToolchainState -State $state
    $missing = @($state | Where-Object { -not $_.Ready })
    if ($missing.Count -gt 0 -and $InstallPrerequisites) {
        Install-CorePrerequisites -State $state -Runner $Runner -Resolver $Resolver -Enabled
        $state = @(Get-CoreToolchainState -Resolver $Resolver -Runner $Runner)
        Write-CoreToolchainState -State $state
        $missing = @($state | Where-Object { -not $_.Ready })
    }
    if ($missing.Count -gt 0) {
        $names = ($missing | ForEach-Object { $_.Name }) -join ', '
        if ($InstallPrerequisites) {
            throw "Core prerequisites are not ready after installation: $names. Open a new shell, then run .\setup.ps1 -CheckOnly"
        }

        try {
            $wingetAvailable = $null -ne (& $Resolver 'winget')
        } catch {
            $wingetAvailable = $false
        }
        if ($wingetAvailable) {
            throw "Core prerequisites are not ready: $names. Next command: .\setup.ps1 -InstallPrerequisites"
        }
        throw "Core prerequisites are not ready: $names. Action: install or update Microsoft App Installer, reopen the shell, then run .\setup.ps1 -CheckOnly"
    }

    Test-ProjectMetadata -Root $ProjectRoot
    if ($ForDeployment) {
        $deploymentState = @(Get-DeploymentToolState -Resolver $Resolver)
        $missingDeploymentTools = @($deploymentState | Where-Object { -not $_.Ready })
        if ($missingDeploymentTools.Count -gt 0) {
            $remedies = @()
            if (@($missingDeploymentTools | Where-Object Name -in @('ssh', 'scp')).Count -gt 0) {
                $remedies += 'OpenSSH Client: Settings > System > Optional features > Add an optional feature > OpenSSH Client'
            }
            if (@($missingDeploymentTools | Where-Object Name -eq 'tar').Count -gt 0) {
                $remedies += 'tar: install or repair the Windows BSD tar component, then reopen PowerShell'
            }
            throw ($remedies -join [Environment]::NewLine)
        }
    }
    if ($ForMigration) {
        $migrationState = Test-MigrationToolchain -Resolver $Resolver -Runner $Runner
        if (-not $migrationState.Ready) {
            $mismatchKinds = @($migrationState.Reasons) -join ', '
            throw "FFmpeg migration check failed. Fixture: $($migrationState.Fixture). Category: $mismatchKinds. Action: verify the tracked fixture and pinned FFmpeg binary, then run .\setup.ps1 -CheckOnly -ForMigration. See docs/windows-setup.md."
        }
    }

    $nodeCommand = [string]($state | Where-Object Name -eq 'node').Command
    $npmCommand = [string]($state | Where-Object Name -eq 'npm').Command
    $previousLocation = (Get-Location).Path
    try {
        Set-Location -LiteralPath $ProjectRoot
        if ($CheckOnly) {
            $exitCode = Invoke-SetupStep -Runner $Runner -File $nodeCommand -Arguments @('scripts/check-portability.mjs')
            if ($exitCode -ne 0) {
                return $exitCode
            }
            if (Test-Path -LiteralPath (Join-Path $ProjectRoot 'node_modules') -PathType Container) {
                $exitCode = Invoke-SetupStep -Runner $Runner -File $npmCommand -Arguments @('ls', '--depth=0')
                if ($exitCode -ne 0) {
                    return $exitCode
                }
            }
            return 0
        }

        $steps = @(
            [pscustomobject]@{ File = $npmCommand; Arguments = @('ci') },
            [pscustomobject]@{ File = $npmCommand; Arguments = @('run', 'check:portability') },
            [pscustomobject]@{ File = $npmCommand; Arguments = @('run', 'verify') }
        )
        foreach ($step in $steps) {
            $exitCode = Invoke-SetupStep -Runner $Runner -File $step.File -Arguments $step.Arguments
            if ($exitCode -ne 0) {
                return $exitCode
            }
        }
        return 0
    } finally {
        Set-Location -LiteralPath $previousLocation
    }
}

if ($MyInvocation.InvocationName -ne '.') {
    try {
        exit (Invoke-IconamasterSetup @PSBoundParameters)
    } catch {
        [Console]::Error.WriteLine($_.Exception.Message)
        exit 1
    }
}
