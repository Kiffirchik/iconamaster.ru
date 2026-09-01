import assert from 'node:assert/strict';
import test from 'node:test';
import { findMachinePathFindings } from '../../scripts/lib/portability.mjs';

const windowsProfile = ['C:', 'Users', 'alice', 'project', 'file.txt'].join('\\');
const slashProfile = ['D:', 'Users', 'bob', 'AppData', 'Local', 'Temp', 'x.png'].join('/');

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

test('allows runtime roots, URLs and documented MTW server paths', () => {
  assert.deepEqual(findMachinePathFindings([
    { path: 'setup.ps1', text: 'Join-Path $PSScriptRoot package.json' },
    { path: 'scripts/example.mjs', text: 'new URL("../public", import.meta.url)' },
    { path: 'docs/deploy.md', text: 'https://iconamaster.ru /www/vhosts/example/httpdocs' },
    { path: 'docs/example.md', text: '<drive>:\\Users\\<profile>\\project' },
  ]), []);
});
