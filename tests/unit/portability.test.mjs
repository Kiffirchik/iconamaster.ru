import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { link, mkdir, mkdtemp, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { findMachinePathFindings, trackedTextRecords } from '../../scripts/lib/portability.mjs';

const execFileAsync = promisify(execFile);

const windowsProfile = ['C:', 'Users', 'alice', 'project', 'file.txt'].join('\\');
const slashProfile = ['D:', 'Users', 'bob', 'AppData', 'Local', 'Temp', 'x.png'].join('/');
const legacyProfile = ['E:', 'Documents and Settings', 'carol', 'Application Data', 'prefs.json'].join('\\');
const driveWorkspace = ['D:', 'work', 'Iconamaster'].join('\\');
const driveTempArtifact = ['C:', 'Temp', 'artifact'].join('\\');
const localAppDataCache = ['%LOCALAPPDATA%', 'Iconamaster', 'cache'].join('\\');
const tempWorkspace = ['%TEMP%', 'Iconamaster'].join('\\');
const siblingDependency = ['..', 'Iconamaster-copy', 'asset'].join('\\');
const powershellTempRoot = ['$env:', 'TEMP'].join('');
const powershellLocalAppDataRoot = ['${env:', 'LOCALAPPDATA', '}'].join('');
const powershellTempWorkspace = [powershellTempRoot, 'Iconamaster'].join('\\');
const powershellLocalAppData = [powershellLocalAppDataRoot, 'Iconamaster'].join('\\');
const slashSiblingDependency = ['..', 'Iconamaster-copy', 'asset'].join('/');
const runtimeParentPath = ['$PSScriptRoot', '..', 'package.json'].join('\\');
const releaseSiblingDependency = ['..', 'release-checkout', 'asset'].join('\\');
const slashReleaseSiblingDependency = ['..', 'release-checkout', 'asset'].join('/');
const runtimeAssetPath = ['$PSScriptRoot', '..', 'Iconamaster-assets', 'manifest.json'].join('\\');
const slashRuntimeAssetPath = ['$PSScriptRoot', '..', 'Iconamaster-assets', 'manifest.json'].join('/');
const ordinaryRelativeImport = ['..', 'shared', 'module.mjs'].join('/');

test('flags local Windows profiles and file URLs', (t) => {
  t.diagnostic('ICONAMASTER_PORTABILITY_UNIT_MARKER');
  const findings = findMachinePathFindings([
    { path: 'scripts/example.mjs', text: `open(${JSON.stringify(windowsProfile)})` },
    { path: 'docs/example.md', text: slashProfile },
    { path: 'src/example.js', text: `file:///${slashProfile}` },
  ]);
  assert.deepEqual(findings.map(({ path }) => path), [
    'scripts/example.mjs', 'docs/example.md', 'src/example.js',
  ]);
});

test('flags JSON-escaped legacy Windows profiles', () => {
  const findings = findMachinePathFindings([
    { path: 'config/example.json', text: JSON.stringify({ source: legacyProfile }) },
  ]);
  assert.deepEqual(findings.map(({ path, kind }) => ({ path, kind })), [
    { path: 'config/example.json', kind: 'legacy-windows-profile' },
  ]);
});

test('flags arbitrary drive roots, Windows profile environments, and sibling dependencies', () => {
  const findings = findMachinePathFindings([
    { path: 'scripts/workspace.ps1', text: `Set-Location ${driveWorkspace}` },
    { path: 'scripts/archive.ps1', text: `Copy-Item ${driveTempArtifact}` },
    { path: 'config/cache.txt', text: localAppDataCache },
    { path: 'config/temp.txt', text: tempWorkspace },
    { path: 'scripts/copy.ps1', text: `Copy-Item ${siblingDependency}` },
  ]);

  assert.deepEqual(findings.map(({ path, kind }) => ({ path, kind })), [
    { path: 'scripts/workspace.ps1', kind: 'windows-drive-root' },
    { path: 'scripts/archive.ps1', kind: 'windows-drive-root' },
    { path: 'config/cache.txt', kind: 'windows-profile-environment' },
    { path: 'config/temp.txt', kind: 'windows-profile-environment' },
    { path: 'scripts/copy.ps1', kind: 'windows-parent-dependency' },
  ]);
});

test('flags PowerShell profile environments and slash-separated sibling dependencies', () => {
  const findings = findMachinePathFindings([
    { path: 'scripts/temp.ps1', text: `New-Item ${powershellTempWorkspace}` },
    { path: 'scripts/cache.ps1', text: `Join-Path ${powershellLocalAppData} cache` },
    { path: 'scripts/copy.mjs', text: `copy('${slashSiblingDependency}')` },
  ]);

  assert.deepEqual(findings.map(({ path, kind }) => ({ path, kind })), [
    { path: 'scripts/temp.ps1', kind: 'windows-profile-environment' },
    { path: 'scripts/cache.ps1', kind: 'windows-profile-environment' },
    { path: 'scripts/copy.mjs', kind: 'windows-parent-dependency' },
  ]);
});

test('flags operational sibling dependencies independent of basename and separator', () => {
  const findings = findMachinePathFindings([
    { path: 'scripts/copy-backslash.ps1', text: `Copy-Item ${releaseSiblingDependency}` },
    { path: 'scripts/copy-slash.ps1', text: `Copy-Item ${slashReleaseSiblingDependency}` },
  ]);

  assert.deepEqual(findings.map(({ path, kind, match }) => ({ path, kind, match })), [
    {
      path: 'scripts/copy-backslash.ps1',
      kind: 'windows-parent-dependency',
      match: releaseSiblingDependency,
    },
    {
      path: 'scripts/copy-slash.ps1',
      kind: 'windows-parent-dependency',
      match: slashReleaseSiblingDependency,
    },
  ]);
});

test('flags bare PowerShell profile environment roots', () => {
  const findings = findMachinePathFindings([
    { path: 'scripts/temp.ps1', text: `Set-Location ${powershellTempRoot}` },
    { path: 'scripts/cache.ps1', text: `Write-Output ${powershellLocalAppDataRoot}` },
  ]);

  assert.deepEqual(findings.map(({ path, kind, match }) => ({ path, kind, match })), [
    { path: 'scripts/temp.ps1', kind: 'windows-profile-environment', match: powershellTempRoot },
    {
      path: 'scripts/cache.ps1',
      kind: 'windows-profile-environment',
      match: powershellLocalAppDataRoot,
    },
  ]);
});

test('does not treat longer PowerShell identifiers or environment prose as profile roots', () => {
  assert.deepEqual(findMachinePathFindings([
    { path: 'docs/identifiers.md', text: '$env:TEMPORARY ${env:LOCALAPPDATA_BACKUP}' },
    { path: 'docs/environment.md', text: 'Use the TEMP environment variable for temporary files.' },
  ]), []);
});

test('does not read tracked text through a symbolic link outside the repository', async (t) => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'iconamaster-portability-'));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));

  const repository = path.join(fixtureRoot, 'repository');
  const outsideFile = path.join(fixtureRoot, 'outside-secret.md');
  await mkdir(repository);
  await writeFile(outsideFile, 'outside secret marker');
  await execFileAsync('git', ['init', '--quiet'], { cwd: repository });
  await execFileAsync('git', ['config', 'core.symlinks', 'true'], { cwd: repository });
  const trackedPath = path.join(repository, 'external.md');
  await writeFile(trackedPath, 'tracked placeholder');
  await execFileAsync('git', ['add', '--', 'external.md'], { cwd: repository });
  await unlink(trackedPath);
  let expectedMode = '100644';

  try {
    await symlink(outsideFile, trackedPath, 'file');
  } catch (error) {
    if (!['EACCES', 'EPERM'].includes(error.code)) throw error;
    t.diagnostic(`symbolic link unavailable (${error.code}); using Git symlink mode with an external hard-link boundary`);
    expectedMode = '120000';
    await writeFile(trackedPath, '../outside-secret.md');
    const { stdout: blob } = await execFileAsync('git', ['hash-object', '-w', '--', 'external.md'], {
      cwd: repository,
    });
    await execFileAsync('git', [
      'update-index', '--add', '--cacheinfo', `120000,${blob.trim()},external.md`,
    ], { cwd: repository });
    await unlink(trackedPath);
    await link(outsideFile, trackedPath);
  }

  const { stdout: staged } = await execFileAsync('git', ['ls-files', '--stage', '--', 'external.md'], {
    cwd: repository,
  });
  assert.match(staged, new RegExp(`^${expectedMode} `, 'u'));
  assert.deepEqual(await trackedTextRecords({ root: repository }), []);
});

test('allows runtime roots, URI schemes, URLs and repository-relative paths', () => {
  assert.deepEqual(findMachinePathFindings([
    { path: 'setup.ps1', text: 'Join-Path $PSScriptRoot package.json' },
    { path: 'setup.ps1', text: runtimeParentPath },
    { path: 'scripts/assets.ps1', text: `Copy-Item ${runtimeAssetPath}` },
    { path: 'scripts/assets.ps1', text: `Copy-Item ${slashRuntimeAssetPath}` },
    { path: 'src/module.mjs', text: `import '${ordinaryRelativeImport}'` },
    { path: 'docs/module.md', text: `[shared module](${ordinaryRelativeImport})` },
    { path: 'scripts/example.mjs', text: 'new URL("../public", import.meta.url)' },
    { path: 'src/resource.txt', text: 'x:/resource' },
    { path: 'docs/deploy.md', text: 'https://iconamaster.ru /www/vhosts/example/httpdocs' },
    { path: 'docs/example.md', text: '<drive>:\\Users\\<profile>\\project' },
    { path: 'docs/versions.md', text: 'Windows 10/11; Node.js ^20.19.0 || >=22.12.0; drive C: is illustrative prose' },
    { path: 'scripts/relative.ps1', text: '.\\setup.ps1 ./asset ./scripts/check-portability.mjs' },
    { path: 'docs/placeholders.md', text: '<workspace>\\cache <legacy-backup>\\assets <drive>:\\Temp\\artifact' },
    { path: 'tests/contact.test.mjs', text: String.raw`/tel:\+79990001122/u` },
    { path: 'tests/styles.test.mjs', text: String.raw`/display:\s*none|min-height:\s*2\.75rem/u` },
  ]), []);
});
