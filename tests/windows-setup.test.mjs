import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const setupPath = path.join(root, 'setup.ps1');
const setup = psLiteral(setupPath);

function psLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function runPowerShell(command) {
  return spawnSync(
    powershell,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
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

test('validates matching package metadata and lockfile version 3', (t) => {
  const valid = createMetadataFixture(t);
  const mismatched = createMetadataFixture(t, { lockName: 'other-project' });
  const oldLockfile = createMetadataFixture(t, { lockfileVersion: 2 });
  const result = runPowerShell(`. ${setup};
    Test-ProjectMetadata -Root ${psLiteral(valid)}
    try { Test-ProjectMetadata -Root ${psLiteral(mismatched)}; exit 21 } catch {}
    try { Test-ProjectMetadata -Root ${psLiteral(oldLockfile)}; exit 22 } catch {}
    exit 0`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

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

test('package metadata declares the supported runtime versions', () => {
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  assert.equal(packageJson.packageManager, 'npm@10.8.2');
  assert.deepEqual(packageJson.engines, { node: '^20.19.0 || >=22.12.0', npm: '>=10' });
  assert.deepEqual(lock.packages[''].engines, packageJson.engines);
});
