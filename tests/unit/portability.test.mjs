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

test('flags local Windows profiles and file URLs', () => {
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

test('allows runtime roots, URLs and documented MTW server paths', () => {
  assert.deepEqual(findMachinePathFindings([
    { path: 'setup.ps1', text: 'Join-Path $PSScriptRoot package.json' },
    { path: 'scripts/example.mjs', text: 'new URL("../public", import.meta.url)' },
    { path: 'docs/deploy.md', text: 'https://iconamaster.ru /www/vhosts/example/httpdocs' },
    { path: 'docs/example.md', text: '<drive>:\\Users\\<profile>\\project' },
  ]), []);
});
