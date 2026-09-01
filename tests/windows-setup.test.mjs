import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { access, cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const powershell = path.join(
  process.env.SystemRoot,
  'System32',
  'WindowsPowerShell',
  'v1.0',
  'powershell.exe',
);
const pwshProbe = spawnSync(
  'pwsh.exe',
  ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'],
  { cwd: root, encoding: 'utf8', windowsHide: true },
);
const pwshVersion = pwshProbe.status === 0 ? pwshProbe.stdout.trim() : null;
const pwsh = Number.parseInt(pwshVersion?.split('.')[0] ?? '', 10) >= 7 ? 'pwsh.exe' : null;
const supportedShells = [
  { name: 'Windows PowerShell 5.1', executable: powershell, version: '5.1' },
  { name: 'PowerShell 7+', executable: pwsh, version: pwshVersion },
];
const setupPath = path.join(root, 'setup.ps1');
const setup = psLiteral(setupPath);
const migrationFixtureReference = 'tests/fixtures/migration/editorial-cover-assets.json';

function psLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function privatePathMarker(label, fileName) {
  return `${label}-${['C:', 'private', fileName].join('/')}`;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runShell(shell, command) {
  return spawnSync(
    shell,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
}

function runPowerShell(command) {
  return runShell(powershell, command);
}

function runSetupFile(arguments_) {
  return spawnSync(
    powershell,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', setupPath, ...arguments_],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
}

function createMetadataFixture(t, { lockName = 'fixture-project', lockfileVersion = 3 } = {}) {
  const fixture = mkdtempSync(path.join(tmpdir(), 'iconamaster-setup-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  writeFileSync(path.join(fixture, 'package.json'), JSON.stringify({ name: 'fixture-project' }));
  writeFileSync(path.join(fixture, 'package-lock.json'), JSON.stringify({
    name: lockName,
    lockfileVersion,
    packages: { '': { name: lockName } },
  }));
  return fixture;
}

function createMigrationFixture(t) {
  const fixture = createMetadataFixture(t);
  const binary = path.join(fixture, 'ffmpeg.exe');
  const fixturePath = path.join(
    fixture,
    'tests',
    'fixtures',
    'migration',
    'editorial-cover-assets.json',
  );
  const contents = Buffer.from('controlled ffmpeg fixture\n', 'utf8');
  const versionLine = 'ffmpeg version pinned-test-build';
  writeFileSync(binary, contents);
  mkdirSync(path.dirname(fixturePath), { recursive: true });
  writeFileSync(fixturePath, JSON.stringify({
    encoder: {
      command: 'ffmpeg',
      binarySha256: createHash('sha256').update(contents).digest('hex'),
      versionLine,
    },
  }));
  return { fixture, fixturePath, binary, versionLine };
}

function assertControlledMigrationFailure(result, {
  reason,
  projectRoot,
  executable,
  forbidden = [],
}) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.ok(output.includes([
    `FFmpeg migration check failed. Fixture: ${migrationFixtureReference}.`,
    `Category: ${reason}.`,
    'Action: verify the tracked fixture and pinned FFmpeg binary,',
    'then run .\\setup.ps1 -CheckOnly -ForMigration.',
    'See docs/windows-setup.md.',
  ].join(' ')), output);
  for (const value of [projectRoot, executable, process.env.USERPROFILE, ...forbidden]) {
    if (!value) continue;
    assert.ok(!output.includes(value), `diagnostic disclosed ${value}:\n${output}`);
  }
}

test('accepts only the declared Node and npm version policies', () => {
  const result = runPowerShell(`. ${setup};
    if (-not (Test-NodeVersionPolicy 'v20.19.0')) { exit 11 }
    if (Test-NodeVersionPolicy '20.18.9') { exit 12 }
    if (Test-NodeVersionPolicy '21.99.99') { exit 13 }
    if (-not (Test-NodeVersionPolicy '22.12.0')) { exit 14 }
    if (Test-NodeVersionPolicy '22.11.0') { exit 15 }
    if (-not (Test-NodeVersionPolicy '23.0.0')) { exit 16 }
    if (-not (Test-NpmVersionPolicy '10.0.0')) { exit 17 }
    if (Test-NpmVersionPolicy '9.9.9') { exit 18 }
    try { Test-NodeVersionPolicy 'not-a-version'; exit 19 } catch {}
    exit 0`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

for (const shell of supportedShells) {
  test(`validates exact package metadata in ${shell.name}`, { skip: !shell.executable }, (t) => {
    t.diagnostic(`exercising PowerShell ${shell.version}`);
    const valid = createMetadataFixture(t);
    const mismatched = createMetadataFixture(t, { lockName: 'other-project' });
    const oldLockfile = createMetadataFixture(t, { lockfileVersion: 2 });
    const result = runShell(shell.executable, `. ${setup};
      Test-ProjectMetadata -Root ${psLiteral(valid)}
      try { Test-ProjectMetadata -Root ${psLiteral(mismatched)}; exit 21 } catch {}
      try { Test-ProjectMetadata -Root ${psLiteral(oldLockfile)}; exit 22 } catch {}
      exit 0`);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
}

test('derives core readiness from real version policies and command results', () => {
  const result = runPowerShell(`. ${setup};
    $resolver = { param($Name) [pscustomobject]@{ Source = $Name } }
    $runner = {
      param($File, $Arguments)
      if ($Arguments -ne '--version') { return 90 }
      switch ($File) {
        'git' { 'git version 2.46.0'; return 0 }
        'node' { 'v22.11.0'; return 0 }
        'npm' { '10.8.2'; return 0 }
        default { return 91 }
      }
    }
    $state = @(Get-CoreToolchainState -Resolver $resolver -Runner $runner)
    if (-not ($state | Where-Object Name -eq 'git').Ready) { exit 23 }
    if (($state | Where-Object Name -eq 'node').Ready) { exit 24 }
    if (-not ($state | Where-Object Name -eq 'npm').Ready) { exit 25 }
    if (($state | Where-Object Name -eq 'node').Found -ne 'v22.11.0') { exit 26 }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('public setup fails without installing when prerequisites are not ready', (t) => {
  const fixture = createMetadataFixture(t);
  const marker = path.join(fixture, 'installation.marker');
  const result = runPowerShell(`. ${setup};
    $resolver = { param($Name) [pscustomobject]@{ Source = $Name } }
    $runner = {
      param($File, $Arguments)
      if ($File -eq 'winget') { Set-Content -LiteralPath ${psLiteral(marker)} -Value 'installed'; return 0 }
      if ($File -eq 'git') { return 127 }
      if ($File -eq 'node') { 'v20.19.0'; return 0 }
      if ($File -eq 'npm') { '10.8.2'; return 0 }
      return 0
    }
    try {
      Invoke-IconamasterSetup -CheckOnly -ProjectRoot ${psLiteral(fixture)} -Resolver $resolver -Runner $runner
      exit 27
    } catch {
      if (Test-Path -LiteralPath ${psLiteral(marker)}) { exit 28 }
      if ($_.Exception.Message -notmatch 'not ready') { exit 29 }
    }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(readFileSync(path.join(fixture, 'package.json'), 'utf8'), '{"name":"fixture-project"}');
});

for (const scenario of [
  {
    name: 'missing Git',
    missingName: 'git',
    resolverBranch: "if ($Name -eq 'git') { return $null }",
    nodeVersion: 'v20.19.0',
  },
  {
    name: 'outdated Node.js',
    missingName: 'node',
    resolverBranch: '',
    nodeVersion: 'v22.11.0',
  },
]) {
  test(`${scenario.name} with winget available prints the exact installation command`, (t) => {
    const fixture = createMetadataFixture(t);
    const result = runPowerShell(`. ${setup};
      $resolver = {
        param($Name)
        ${scenario.resolverBranch}
        return [pscustomobject]@{ Source=$Name }
      }
      $runner = {
        param($File, $Arguments)
        if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
        if ($File -eq 'node') { '${scenario.nodeVersion}'; return 0 }
        if ($File -eq 'npm') { '10.8.2'; return 0 }
        if ($File -eq 'winget') { exit 71 }
        return 0
      }
      try {
        $null = Invoke-IconamasterSetup -CheckOnly -ProjectRoot ${psLiteral(fixture)} -Resolver $resolver -Runner $runner
        exit 72
      } catch {
        Write-Output $_.Exception.Message
      }`);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(result.stdout.includes(
      `Core prerequisites are not ready: ${scenario.missingName}. Next command: .\\setup.ps1 -InstallPrerequisites`,
    ), result.stdout);
    assert.ok(!result.stdout.includes(fixture), result.stdout);
  });
}

test('missing winget directs users through Microsoft App Installer and a safe recheck', (t) => {
  const fixture = createMetadataFixture(t);
  const result = runPowerShell(`. ${setup};
    $resolver = {
      param($Name)
      if ($Name -in @('node', 'winget')) { return $null }
      return [pscustomobject]@{ Source=$Name }
    }
    $runner = {
      param($File, $Arguments)
      if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
      if ($File -eq 'npm') { '10.8.2'; return 0 }
      return 0
    }
    try {
      $null = Invoke-IconamasterSetup -CheckOnly -ProjectRoot ${psLiteral(fixture)} -Resolver $resolver -Runner $runner
      exit 73
    } catch {
      Write-Output $_.Exception.Message
    }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes([
    'Core prerequisites are not ready: node.',
    'Action: install or update Microsoft App Installer, reopen the shell,',
    'then run .\\setup.ps1 -CheckOnly',
  ].join(' ')), result.stdout);
  assert.ok(!result.stdout.includes(fixture), result.stdout);
});

test('failed recheck after installation directs users to a new shell and check-only', (t) => {
  const fixture = createMetadataFixture(t);
  const result = runPowerShell(`. ${setup};
    $resolver = { param($Name) [pscustomobject]@{ Source=$Name } }
    $runner = {
      param($File, $Arguments)
      if ($File -eq 'git') { return 127 }
      if ($File -eq 'node') { 'v20.19.0'; return 0 }
      if ($File -eq 'npm') { '10.8.2'; return 0 }
      if ($File -eq 'winget') { return 0 }
      return 0
    }
    try {
      $null = Invoke-IconamasterSetup -CheckOnly:$false -InstallPrerequisites -ProjectRoot ${psLiteral(fixture)} -Resolver $resolver -Runner $runner
      exit 74
    } catch {
      Write-Output $_.Exception.Message
    }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.ok(result.stdout.includes([
    'Core prerequisites are not ready after installation: git.',
    'Open a new shell, then run .\\setup.ps1 -CheckOnly',
  ].join(' ')), result.stdout);
  assert.ok(!result.stdout.includes(fixture), result.stdout);
});

test('rejects check-only plus installation before doing work', () => {
  const result = runSetupFile(['-CheckOnly', '-InstallPrerequisites']);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /cannot be used together/iu);
});

test('clean Git copy in a path with spaces runs check-only without installing dependencies', async () => {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'Iconamaster setup test '));
  const copyRoot = path.join(tempRoot, 'Clean Git copy with spaces');

  try {
    mkdirSync(path.join(copyRoot, 'scripts', 'lib'), { recursive: true });
    await Promise.all([
      cp(path.join(root, 'setup.ps1'), path.join(copyRoot, 'setup.ps1')),
      cp(path.join(root, 'package.json'), path.join(copyRoot, 'package.json')),
      cp(path.join(root, 'package-lock.json'), path.join(copyRoot, 'package-lock.json')),
      cp(
        path.join(root, 'scripts', 'check-portability.mjs'),
        path.join(copyRoot, 'scripts', 'check-portability.mjs'),
      ),
      cp(
        path.join(root, 'scripts', 'lib', 'portability.mjs'),
        path.join(copyRoot, 'scripts', 'lib', 'portability.mjs'),
      ),
    ]);

    const init = spawnSync('git', ['init'], {
      cwd: copyRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(init.status, 0, `${init.stdout}\n${init.stderr}`);

    const add = spawnSync('git', [
      'add',
      '--',
      'setup.ps1',
      'package.json',
      'package-lock.json',
      'scripts/check-portability.mjs',
      'scripts/lib/portability.mjs',
    ], {
      cwd: copyRoot,
      encoding: 'utf8',
      windowsHide: true,
    });
    assert.equal(add.status, 0, `${add.stdout}\n${add.stderr}`);

    const result = spawnSync(
      powershell,
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        path.join(copyRoot, 'setup.ps1'),
        '-CheckOnly',
      ],
      { cwd: tempRoot, encoding: 'utf8', windowsHide: true },
    );

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(await exists(path.join(copyRoot, 'node_modules')), false);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('npm test executes the portability unit tests', () => {
  const testName = 'flags arbitrary drive roots, Windows profile environments, and sibling dependencies';
  const packageEnv = { ...process.env };
  delete packageEnv.NODE_TEST_CONTEXT;
  const npmCli = path.join(
    path.dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js',
  );
  const result = spawnSync(
    process.execPath,
    [npmCli, 'test', '--', '--test-name-pattern', `^${testName}$`],
    { cwd: root, encoding: 'utf8', windowsHide: true, env: packageEnv },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, new RegExp(`ok \\d+ - ${testName}\\r?\\n`, 'u'));
});

test('explicit installation emits exact deduplicated winget commands', (t) => {
  const fixture = createMetadataFixture(t);
  const transcript = path.join(fixture, 'winget-transcript.txt');
  const result = runPowerShell(`. ${setup};
    $resolver = { param($Name) if ($Name -eq 'winget') { [pscustomobject]@{ Source = 'winget' } } }
    $runner = {
      param($File, $Arguments)
      Add-Content -LiteralPath ${psLiteral(transcript)} -Value ($File + '|' + ($Arguments -join '|'))
      return 0
    }
    $state = @(
      [pscustomobject]@{ Name='git'; Ready=$false; Found=$null; Required='installed' },
      [pscustomobject]@{ Name='node'; Ready=$false; Found=$null; Required='^20.19.0 || >=22.12.0' },
      [pscustomobject]@{ Name='npm'; Ready=$false; Found=$null; Required='>=10' }
    )
    Install-CorePrerequisites -State $state -Runner $runner -Resolver $resolver -Enabled`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.deepEqual(readFileSync(transcript, 'utf8').trim().split(/\r?\n/u), [
    'winget|install|--exact|--id|Git.Git|--accept-package-agreements|--accept-source-agreements|--disable-interactivity',
    'winget|install|--exact|--id|OpenJS.NodeJS.LTS|--accept-package-agreements|--accept-source-agreements|--disable-interactivity',
  ]);
});

test('check-only selects portability and preserves its nonzero exit code', (t) => {
  const fixture = createMetadataFixture(t);
  const transcript = path.join(fixture, 'check-transcript.txt');
  const result = runPowerShell(`. ${setup};
    $resolver = { param($Name) [pscustomobject]@{ Source = $Name } }
    $runner = {
      param($File, $Arguments)
      Add-Content -LiteralPath ${psLiteral(transcript)} -Value ($File + '|' + ($Arguments -join '|'))
      if ($Arguments -eq '--version') {
        if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
        if ($File -eq 'node') { 'v20.19.0'; return 0 }
        if ($File -eq 'npm') { '10.8.2'; return 0 }
      }
      if ($File -eq 'node') { return 37 }
      return 0
    }
    $code = @(Invoke-IconamasterSetup -CheckOnly -ProjectRoot ${psLiteral(fixture)} -Resolver $resolver -Runner $runner)
    if ($code.Count -ne 1 -or $code[0] -ne 37) { exit 30 }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.deepEqual(readFileSync(transcript, 'utf8').trim().split(/\r?\n/u), [
    'git|--version',
    'node|--version',
    'npm|--version',
    'node|scripts/check-portability.mjs',
  ]);
});

test('default setup stops before verify when portability fails', (t) => {
  const fixture = createMetadataFixture(t);
  const transcript = path.join(fixture, 'default-transcript.txt');
  const result = runPowerShell(`. ${setup};
    $resolver = { param($Name) [pscustomobject]@{ Source = $Name } }
    $runner = {
      param($File, $Arguments)
      Add-Content -LiteralPath ${psLiteral(transcript)} -Value ($File + '|' + ($Arguments -join '|'))
      if ($Arguments -eq '--version') {
        if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
        if ($File -eq 'node') { 'v20.19.0'; return 0 }
        if ($File -eq 'npm') { '10.8.2'; return 0 }
      }
      if ($File -eq 'npm' -and ($Arguments -join ' ') -eq 'run check:portability') { return 41 }
      return 0
    }
    $code = @(Invoke-IconamasterSetup -ProjectRoot ${psLiteral(fixture)} -Resolver $resolver -Runner $runner)
    if ($code.Count -ne 1 -or $code[0] -ne 41) { exit 31 }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.deepEqual(readFileSync(transcript, 'utf8').trim().split(/\r?\n/u), [
    'git|--version',
    'node|--version',
    'npm|--version',
    'npm|ci',
    'npm|run|check:portability',
  ]);
});

for (const shell of supportedShells) {
  test(`deployment mode keeps optional tools separate in ${shell.name}`, { skip: !shell.executable }, (t) => {
    t.diagnostic(`exercising PowerShell ${shell.version}`);
    const result = runShell(shell.executable, `. ${setup};
      $resolver = { param($Name) if ($Name -in @('ssh','tar')) { [pscustomobject]@{ Source=$Name } } }
      $state = Get-DeploymentToolState $resolver
      if (($state | Where-Object Name -eq 'scp').Ready) { exit 21 }
      if (-not ($state | Where-Object Name -eq 'ssh').Ready) { exit 22 }
      if (-not ($state | Where-Object Name -eq 'tar').Ready) { exit 23 }`);
    assert.equal(result.status, 0, result.stderr);
  });
}

test('migration mode rejects checksum and version drift', () => {
  const result = runPowerShell(`. ${setup};
    $expected = [pscustomobject]@{ binarySha256='${'a'.repeat(64)}'; versionLine='ffmpeg version pinned' }
    $actual = [pscustomobject]@{ binarySha256='${'b'.repeat(64)}'; versionLine='ffmpeg version other' }
    $state = Compare-FfmpegIdentity -Expected $expected -Actual $actual
    if ($state.Ready) { exit 24 }
    if ($state.Reasons.Count -ne 2) { exit 25 }`);
  assert.equal(result.status, 0, result.stderr);
});

test('FFmpeg version identity rejects case-only drift independently', () => {
  const result = runPowerShell(`. ${setup};
    $expected = [pscustomobject]@{ binarySha256='${'a'.repeat(64)}'; versionLine='ffmpeg version Pinned' }
    $actual = [pscustomobject]@{ binarySha256='${'a'.repeat(64)}'; versionLine='ffmpeg version pinned' }
    $state = Compare-FfmpegIdentity -Expected $expected -Actual $actual
    if ($state.Ready) { exit 75 }
    if ($state.Reasons.Count -ne 1 -or $state.Reasons[0] -cne 'version') { exit 76 }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('FFmpeg hash identity accepts uppercase expected and lowercase actual values', () => {
  const result = runPowerShell(`. ${setup};
    $expected = [pscustomobject]@{ binarySha256='${'A'.repeat(64)}'; versionLine='ffmpeg version pinned' }
    $actual = [pscustomobject]@{ binarySha256='${'a'.repeat(64)}'; versionLine='ffmpeg version pinned' }
    $state = Compare-FfmpegIdentity -Expected $expected -Actual $actual
    if (-not $state.Ready) { exit 77 }
    if ($state.Reasons.Count -ne 0) { exit 78 }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

for (const shell of supportedShells) {
  test(`migration mode verifies the pinned identity in ${shell.name}`, { skip: !shell.executable }, (t) => {
    t.diagnostic(`exercising PowerShell ${shell.version}`);
    const migration = createMigrationFixture(t);
    const result = runShell(shell.executable, `. ${setup};
      $script:IconamasterProjectRoot = ${psLiteral(migration.fixture)}
      $resolver = {
        param($Name)
        if ($Name -eq 'ffmpeg') { [pscustomobject]@{ Source=${psLiteral(migration.binary)} } }
      }
      $runner = {
        param($File, $Arguments)
        if ($File -ne ${psLiteral(migration.binary)}) { return 81 }
        if (($Arguments -join ' ') -ne '-version') { return 82 }
        ${psLiteral(migration.versionLine)}
        'configuration: ignored second line'
        return 0
      }
      $state = Test-MigrationToolchain $resolver $runner
      if (-not $state.Ready) { exit 26 }
      if ($state.Reasons.Count -ne 0) { exit 27 }
      if ($state.Fixture -ne ${psLiteral(migrationFixtureReference)}) { exit 28 }`);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
}

test('requested optional checks finish before npm ci', (t) => {
  const migration = createMigrationFixture(t);
  const transcript = path.join(migration.fixture, 'optional-transcript.txt');
  const result = runPowerShell(`. ${setup};
    $script:IconamasterProjectRoot = ${psLiteral(migration.fixture)}
    $resolver = {
      param($Name)
      Add-Content -LiteralPath ${psLiteral(transcript)} -Value ('resolve|' + $Name)
      if ($Name -eq 'ffmpeg') { return [pscustomobject]@{ Source=${psLiteral(migration.binary)} } }
      return [pscustomobject]@{ Source=$Name }
    }
    $runner = {
      param($File, $Arguments)
      Add-Content -LiteralPath ${psLiteral(transcript)} -Value ('run|' + $File + '|' + ($Arguments -join '|'))
      if ($Arguments -eq '--version') {
        if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
        if ($File -eq 'node') { 'v20.19.0'; return 0 }
        if ($File -eq 'npm') { '10.8.2'; return 0 }
      }
      if ($File -eq ${psLiteral(migration.binary)} -and $Arguments -eq '-version') {
        ${psLiteral(migration.versionLine)}
        return 0
      }
      return 0
    }
    $code = @(Invoke-IconamasterSetup -ForDeployment -ForMigration -ProjectRoot ${psLiteral(migration.fixture)} -Resolver $resolver -Runner $runner)
    if ($code.Count -ne 1 -or $code[0] -ne 0) { exit 29 }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const lines = readFileSync(transcript, 'utf8').trim().split(/\r?\n/u);
  const npmCi = lines.indexOf('run|npm|ci');
  for (const optionalEvent of [
    'resolve|ssh',
    'resolve|scp',
    'resolve|tar',
    `run|${migration.binary}|-version`,
  ]) {
    const optionalIndex = lines.indexOf(optionalEvent);
    assert.notEqual(optionalIndex, -1, `missing transcript event: ${optionalEvent}`);
    assert.ok(optionalIndex < npmCi, `${optionalEvent} must precede npm ci`);
  }
});

test('missing deployment tools fail with safe Windows remedies without running them', (t) => {
  const fixture = createMetadataFixture(t);
  const transcript = path.join(fixture, 'deployment-failure-transcript.txt');
  const result = runPowerShell(`. ${setup};
    $resolver = {
      param($Name)
      if ($Name -in @('git', 'node', 'npm', 'ssh')) { [pscustomobject]@{ Source=$Name } }
    }
    $runner = {
      param($File, $Arguments)
      Add-Content -LiteralPath ${psLiteral(transcript)} -Value ($File + '|' + ($Arguments -join '|'))
      if ($Arguments -eq '--version') {
        if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
        if ($File -eq 'node') { 'v20.19.0'; return 0 }
        if ($File -eq 'npm') { '10.8.2'; return 0 }
      }
      return 0
    }
    try {
      $null = Invoke-IconamasterSetup -CheckOnly -ForDeployment -ProjectRoot ${psLiteral(fixture)} -Resolver $resolver -Runner $runner
      exit 41
    } catch {
      Write-Output $_.Exception.Message
    }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /OpenSSH Client: Settings > System > Optional features > Add an optional feature > OpenSSH Client/u);
  assert.match(result.stdout, /tar: install or repair the Windows BSD tar component, then reopen PowerShell/u);
  assert.deepEqual(readFileSync(transcript, 'utf8').trim().split(/\r?\n/u), [
    'git|--version',
    'node|--version',
    'npm|--version',
  ]);
});

test('migration failure reports only the fixture and mismatch kinds', (t) => {
  const migration = createMigrationFixture(t);
  const expectedHash = 'a'.repeat(64);
  const expectedVersion = 'ffmpeg version expected-secret-identity';
  writeFileSync(migration.fixturePath, JSON.stringify({
    encoder: {
      command: 'ffmpeg',
      binarySha256: expectedHash,
      versionLine: expectedVersion,
    },
  }));
  const result = runPowerShell(`. ${setup};
    $script:IconamasterProjectRoot = ${psLiteral(migration.fixture)}
    $resolver = {
      param($Name)
      if ($Name -eq 'ffmpeg') { return [pscustomobject]@{ Source=${psLiteral(migration.binary)} } }
      return [pscustomobject]@{ Source=$Name }
    }
    $runner = {
      param($File, $Arguments)
      if ($Arguments -eq '--version') {
        if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
        if ($File -eq 'node') { 'v20.19.0'; return 0 }
        if ($File -eq 'npm') { '10.8.2'; return 0 }
      }
      if ($File -eq ${psLiteral(migration.binary)} -and $Arguments -eq '-version') {
        ${psLiteral(migration.versionLine)}
        return 0
      }
      return 0
    }
    try {
      $null = Invoke-IconamasterSetup -CheckOnly -ForMigration -ProjectRoot ${psLiteral(migration.fixture)} -Resolver $resolver -Runner $runner
      exit 42
    } catch {
      Write-Output $_.Exception.Message
    }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assertControlledMigrationFailure(result, {
    reason: 'checksum, version',
    projectRoot: migration.fixture,
    executable: migration.binary,
    forbidden: [expectedHash, expectedVersion, migration.versionLine, migration.fixturePath],
  });
});

test('nonzero ffmpeg version exit reports version-command with matching identity', (t) => {
  const migration = createMigrationFixture(t);
  const result = runPowerShell(`. ${setup};
    $script:IconamasterProjectRoot = ${psLiteral(migration.fixture)}
    $resolver = { param($Name) [pscustomobject]@{ Source=${psLiteral(migration.binary)} } }
    $runner = {
      param($File, $Arguments)
      ${psLiteral(migration.versionLine)}
      return 73
    }
    $state = Test-MigrationToolchain $resolver $runner
    if ($state.Ready) { exit 51 }
    if ($state.Reasons.Count -ne 1) { exit 52 }
    if ($state.Reasons[0] -cne 'version-command') { exit 53 }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('migration fixture read failure uses a controlled reason', (t) => {
  const missingRoot = createMetadataFixture(t);
  const missingFixture = path.join(
    missingRoot,
    'tests',
    'fixtures',
    'migration',
    'editorial-cover-assets.json',
  );
  const readResult = runPowerShell(`. ${setup};
    $script:IconamasterProjectRoot = ${psLiteral(missingRoot)}
    $resolver = { param($Name) [pscustomobject]@{ Source=$Name } }
    $runner = {
      param($File, $Arguments)
      if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
      if ($File -eq 'node') { 'v20.19.0'; return 0 }
      if ($File -eq 'npm') { '10.8.2'; return 0 }
      return 0
    }
    try {
      $null = Invoke-IconamasterSetup -CheckOnly -ForMigration -ProjectRoot ${psLiteral(missingRoot)} -Resolver $resolver -Runner $runner
      exit 54
    } catch {
      Write-Output $_.Exception.Message
    }`);
  assertControlledMigrationFailure(readResult, {
    reason: 'fixture-read',
    projectRoot: missingRoot,
    forbidden: [missingFixture],
  });
});

test('migration fixture parse failure hides raw fixture content', (t) => {
  const malformed = createMigrationFixture(t);
  const parseSecret = privatePathMarker('parse-secret-marker', 'editorial-cover-assets.json');
  writeFileSync(malformed.fixturePath, `{${parseSecret}`);
  const parseResult = runPowerShell(`. ${setup};
    $script:IconamasterProjectRoot = ${psLiteral(malformed.fixture)}
    $resolver = { param($Name) [pscustomobject]@{ Source=$Name } }
    $runner = {
      param($File, $Arguments)
      if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
      if ($File -eq 'node') { 'v20.19.0'; return 0 }
      if ($File -eq 'npm') { '10.8.2'; return 0 }
      return 0
    }
    try {
      $null = Invoke-IconamasterSetup -CheckOnly -ForMigration -ProjectRoot ${psLiteral(malformed.fixture)} -Resolver $resolver -Runner $runner
      exit 55
    } catch {
      Write-Output $_.Exception.Message
    }`);
  assertControlledMigrationFailure(parseResult, {
    reason: 'fixture-parse',
    projectRoot: malformed.fixture,
    executable: malformed.binary,
    forbidden: [parseSecret, malformed.fixturePath],
  });
});

test('migration resolver failure hides its raw error', (t) => {
  const migration = createMigrationFixture(t);
  const resolverSecret = privatePathMarker('resolver-secret-marker', 'ffmpeg.exe');
  const result = runPowerShell(`. ${setup};
    $script:IconamasterProjectRoot = ${psLiteral(migration.fixture)}
    $resolver = {
      param($Name)
      if ($Name -eq 'ffmpeg') { throw ${psLiteral(resolverSecret)} }
      return [pscustomobject]@{ Source=$Name }
    }
    $runner = {
      param($File, $Arguments)
      if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
      if ($File -eq 'node') { 'v20.19.0'; return 0 }
      if ($File -eq 'npm') { '10.8.2'; return 0 }
      return 0
    }
    try {
      $null = Invoke-IconamasterSetup -CheckOnly -ForMigration -ProjectRoot ${psLiteral(migration.fixture)} -Resolver $resolver -Runner $runner
      exit 59
    } catch {
      Write-Output $_.Exception.Message
    }`);
  assertControlledMigrationFailure(result, {
    reason: 'resolve',
    projectRoot: migration.fixture,
    executable: migration.binary,
    forbidden: [resolverSecret, migration.fixturePath],
  });
});

test('migration hash failure hides the resolved executable and raw error', (t) => {
  const migration = createMigrationFixture(t);
  const hashSecret = path.join(migration.fixture, 'private-hash-secret', 'ffmpeg.exe');
  const result = runPowerShell(`. ${setup};
    $script:IconamasterProjectRoot = ${psLiteral(migration.fixture)}
    $resolver = {
      param($Name)
      if ($Name -eq 'ffmpeg') { return [pscustomobject]@{ Source=${psLiteral(hashSecret)} } }
      return [pscustomobject]@{ Source=$Name }
    }
    $runner = {
      param($File, $Arguments)
      if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
      if ($File -eq 'node') { 'v20.19.0'; return 0 }
      if ($File -eq 'npm') { '10.8.2'; return 0 }
      return 0
    }
    try {
      $null = Invoke-IconamasterSetup -CheckOnly -ForMigration -ProjectRoot ${psLiteral(migration.fixture)} -Resolver $resolver -Runner $runner
      exit 56
    } catch {
      Write-Output $_.Exception.Message
    }`);
  assertControlledMigrationFailure(result, {
    reason: 'hash',
    projectRoot: migration.fixture,
    executable: hashSecret,
    forbidden: [migration.fixturePath],
  });
});

test('migration module import failure hides the module path and raw error', (t) => {
  const migration = createMigrationFixture(t);
  const moduleSecret = privatePathMarker('module-secret-marker', 'Microsoft.PowerShell.Utility.psd1');
  const result = runPowerShell(`. ${setup};
    $script:IconamasterProjectRoot = ${psLiteral(migration.fixture)}
    function Get-Command { return $null }
    function Import-Module { throw ${psLiteral(moduleSecret)} }
    $resolver = {
      param($Name)
      if ($Name -eq 'ffmpeg') { return [pscustomobject]@{ Source=${psLiteral(migration.binary)} } }
      return [pscustomobject]@{ Source=$Name }
    }
    $runner = {
      param($File, $Arguments)
      if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
      if ($File -eq 'node') { 'v20.19.0'; return 0 }
      if ($File -eq 'npm') { '10.8.2'; return 0 }
      return 0
    }
    try {
      $null = Invoke-IconamasterSetup -CheckOnly -ForMigration -ProjectRoot ${psLiteral(migration.fixture)} -Resolver $resolver -Runner $runner
      exit 57
    } catch {
      Write-Output $_.Exception.Message
    }`);
  assertControlledMigrationFailure(result, {
    reason: 'hash',
    projectRoot: migration.fixture,
    executable: migration.binary,
    forbidden: [moduleSecret, migration.fixturePath],
  });
});

test('migration runner failure hides the executable and raw error', (t) => {
  const migration = createMigrationFixture(t);
  const runnerSecret = privatePathMarker('runner-secret-marker', 'ffmpeg.exe');
  const result = runPowerShell(`. ${setup};
    $script:IconamasterProjectRoot = ${psLiteral(migration.fixture)}
    $resolver = {
      param($Name)
      if ($Name -eq 'ffmpeg') { return [pscustomobject]@{ Source=${psLiteral(migration.binary)} } }
      return [pscustomobject]@{ Source=$Name }
    }
    $runner = {
      param($File, $Arguments)
      if ($File -eq 'git') { 'git version 2.46.0'; return 0 }
      if ($File -eq 'node') { 'v20.19.0'; return 0 }
      if ($File -eq 'npm') { '10.8.2'; return 0 }
      if ($File -eq ${psLiteral(migration.binary)}) { throw ${psLiteral(runnerSecret)} }
      return 0
    }
    try {
      $null = Invoke-IconamasterSetup -CheckOnly -ForMigration -ProjectRoot ${psLiteral(migration.fixture)} -Resolver $resolver -Runner $runner
      exit 58
    } catch {
      Write-Output $_.Exception.Message
    }`);
  assertControlledMigrationFailure(result, {
    reason: 'version-command',
    projectRoot: migration.fixture,
    executable: migration.binary,
    forbidden: [runnerSecret, migration.fixturePath],
  });
});

test('package metadata declares the supported runtime versions', () => {
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(packageJson.packageManager, 'npm@10.8.2');
  assert.deepEqual(packageJson.engines, { node: '^20.19.0 || >=22.12.0', npm: '>=10' });
  assert.deepEqual(lock.packages[''].engines, packageJson.engines);
});
