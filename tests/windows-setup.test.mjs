import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const setupPath = path.join(root, 'setup.ps1');
const setup = psLiteral(setupPath);

function psLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
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

for (const shell of [
  { name: 'Windows PowerShell 5.1', executable: powershell, version: '5.1' },
  { name: 'PowerShell 7+', executable: pwsh, version: pwshVersion },
]) {
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

test('rejects check-only plus installation before doing work', () => {
  const result = runSetupFile(['-CheckOnly', '-InstallPrerequisites']);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /cannot be used together/iu);
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

test('deployment mode requires ssh scp and tar as a separate tool group', () => {
  const result = runPowerShell(`. ${setup};
    $resolver = { param($Name) if ($Name -in @('ssh','tar')) { [pscustomobject]@{ Source=$Name } } }
    $state = Get-DeploymentToolState $resolver
    if (($state | Where-Object Name -eq 'scp').Ready) { exit 21 }
    if (-not ($state | Where-Object Name -eq 'ssh').Ready) { exit 22 }
    if (-not ($state | Where-Object Name -eq 'tar').Ready) { exit 23 }`);
  assert.equal(result.status, 0, result.stderr);
});

test('migration mode rejects checksum and version drift', () => {
  const result = runPowerShell(`. ${setup};
    $expected = [pscustomobject]@{ binarySha256='${'a'.repeat(64)}'; versionLine='ffmpeg version pinned' }
    $actual = [pscustomobject]@{ binarySha256='${'b'.repeat(64)}'; versionLine='ffmpeg version other' }
    $state = Compare-FfmpegIdentity -Expected $expected -Actual $actual
    if ($state.Ready) { exit 24 }
    if ($state.Reasons.Count -ne 2) { exit 25 }`);
  assert.equal(result.status, 0, result.stderr);
});

test('migration toolchain requires the exact fixture hash and first version line', (t) => {
  const migration = createMigrationFixture(t);
  const result = runPowerShell(`. ${setup};
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
    if ($state.Fixture -ne ${psLiteral(migration.fixturePath)}) { exit 28 }`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

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
  assert.ok(result.stdout.includes(migration.fixturePath));
  assert.match(result.stdout, /Mismatch: checksum, version\./u);
  assert.ok(!result.stdout.includes(expectedHash));
  assert.ok(!result.stdout.includes(expectedVersion));
  assert.ok(!result.stdout.includes(migration.versionLine));
  assert.ok(!result.stdout.includes(migration.binary));
});

test('package metadata declares the supported runtime versions', () => {
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(packageJson.packageManager, 'npm@10.8.2');
  assert.deepEqual(packageJson.engines, { node: '^20.19.0 || >=22.12.0', npm: '>=10' });
  assert.deepEqual(lock.packages[''].engines, packageJson.engines);
});
