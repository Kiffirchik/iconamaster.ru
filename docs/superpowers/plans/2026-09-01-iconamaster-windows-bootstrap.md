# Iconamaster Windows Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Создать воспроизводимую Windows-установку Iconamaster с безопасной диагностикой, явной установкой основных prerequisites через winget и автоматической защитой репозитория от машинозависимых путей.

**Architecture:** Корневой `setup.ps1` оркестрирует проверку Windows, системных команд, локальную установку через `npm ci` и полный `npm run verify`; его функции можно dot-source в тестах и вызывать с подменяемыми resolver/runner без реальной установки программ. Отдельный Node.js-модуль сканирует только отслеживаемые текстовые файлы Git и отклоняет локальные абсолютные пути. Deployment- и migration-инструменты включаются только отдельными флагами.

**Tech Stack:** Windows PowerShell 5.1+, PowerShell 7+, Node.js `^20.19.0 || >=22.12.0`, npm 10+, Git for Windows, Node test runner, winget, OpenSSH Client, BSD tar, опциональный закреплённый FFmpeg.

**Spec:** `docs/superpowers/specs/2026-09-01-iconamaster-windows-bootstrap-design.md`

## Global Constraints

- Поддерживаются только Windows 10 и Windows 11.
- Все проектные пути вычисляются от `$PSScriptRoot`, `import.meta.url` или корня Git; текущий каталог запуска не используется как корень проекта.
- `-CheckOnly` не изменяет систему и рабочую копию.
- Системная установка невозможна без явного `-InstallPrerequisites`.
- Автоматически через winget разрешено устанавливать только `Git.Git` и официальный Node.js LTS.
- `ssh`, `scp`, `tar` и FFmpeg не устанавливаются автоматически.
- FFmpeg проверяется по `binarySha256` и `versionLine` из `tests/fixtures/migration/editorial-cover-assets.json`.
- Установщик не читает и не выводит учётные данные и не подключается к MTW.
- Реализация ведётся через failing test → minimal implementation → passing test.
- После каждого самостоятельного блока создаётся отдельный Git-коммит.
- Production-сайт и Sites этой задачей не публикуются.

---

## File map

- `setup.ps1` — пользовательская точка входа, режимы, проверка команд, безопасная winget-установка и запуск npm-команд.
- `scripts/lib/portability.mjs` — чистые функции распознавания машинозависимых путей и чтения списка отслеживаемых текстовых файлов.
- `scripts/check-portability.mjs` — CLI-обёртка проверки переносимости с ненулевым кодом при находках.
- `tests/unit/portability.test.mjs` — unit-тесты детектора и проверка текущего репозитория.
- `tests/windows-setup.test.mjs` — Windows-интеграционные тесты PowerShell-функций, режимов и запуска из пути с пробелами.
- `package.json`, `package-lock.json` — требования версий, package manager и команды проверки.
- `README.md` — короткая основная инструкция запуска.
- `docs/windows-setup.md` — подробная диагностика, deployment- и migration-prerequisites.
- `docs/superpowers/specs/2026-09-01-iconamaster-windows-bootstrap-design.md` — нейтральные примеры путей, не срабатывающие как реальные локальные ссылки.
- `docs/superpowers/plans/2026-08-27-iconamaster-corona-integration.md` — замена локального пути к файлу учётных данных на обозначение вне репозитория.
- `docs/superpowers/plans/2026-08-27-iconamaster-content-migration.md` — замена путей старой рабочей машины на параметр `<legacy-backup>`.
- `design-qa.md` — удаление ссылок на временные локальные изображения Codex с сохранением фактов QA.

---

### Task 1: Portability gate and repository path cleanup

**Files:**
- Create: `scripts/lib/portability.mjs`
- Create: `scripts/check-portability.mjs`
- Create: `tests/unit/portability.test.mjs`
- Modify: `package.json`
- Modify: `docs/superpowers/specs/2026-09-01-iconamaster-windows-bootstrap-design.md:144-145`
- Modify: `docs/superpowers/plans/2026-08-27-iconamaster-corona-integration.md:69`
- Modify: `docs/superpowers/plans/2026-08-27-iconamaster-content-migration.md:464,533,610`
- Modify: `design-qa.md:13-19`

**Interfaces:**
- Consumes: `git ls-files -z`; UTF-8 text from tracked project files.
- Produces: `findMachinePathFindings(records): Finding[]`, `trackedTextRecords({ root }): Promise<Record[]>`, `checkRepositoryPortability({ root }): Promise<Finding[]>`; npm command `check:portability`.

- [ ] **Step 1: Write failing detector tests**

Create `tests/unit/portability.test.mjs` with paths assembled at runtime so the test source itself does not contain a forbidden absolute path:

```js
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
```

- [ ] **Step 2: Run the focused test and verify the module is missing**

Run: `node --test tests/unit/portability.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/lib/portability.mjs`.

- [ ] **Step 3: Implement the text-file scanner and CLI**

Create `scripts/lib/portability.mjs` with these exact boundaries:

```js
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const textExtensions = new Set([
  '.css', '.html', '.js', '.jsx', '.json', '.md', '.mjs', '.ps1',
  '.toml', '.txt', '.yaml', '.yml',
]);
const textNames = new Set(['.gitattributes', '.gitignore', '.htaccess', '.npmrc']);
const patterns = [
  { kind: 'windows-user-profile', expression: /[a-z]:[\\/]Users[\\/][^\\/\s`"']+/giu },
  { kind: 'legacy-windows-profile', expression: /[a-z]:[\\/]Documents and Settings[\\/][^\\/\s`"']+/giu },
  { kind: 'windows-file-url', expression: /file:\/{2,3}[a-z]:\//giu },
];

export function findMachinePathFindings(records) {
  return records.flatMap(({ path: filePath, text }) => patterns.flatMap(({ kind, expression }) => {
    expression.lastIndex = 0;
    return [...text.matchAll(expression)].map((match) => ({
      path: filePath,
      kind,
      match: match[0],
      line: text.slice(0, match.index).split(/\r?\n/u).length,
    }));
  }));
}

function gitTrackedFiles(root) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-c', 'core.quotepath=false', 'ls-files', '-z'], {
      cwd: root, windowsHide: true,
    });
    const chunks = [];
    const errors = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => code === 0
      ? resolve(Buffer.concat(chunks).toString('utf8').split('\0').filter(Boolean))
      : reject(new Error(Buffer.concat(errors).toString('utf8').trim() || `git ls-files exited ${code}`)));
  });
}

export async function trackedTextRecords({ root }) {
  const files = await gitTrackedFiles(root);
  const selected = files.filter((file) => textNames.has(path.basename(file)) || textExtensions.has(path.extname(file)));
  return Promise.all(selected.map(async (file) => ({
    path: file.replaceAll('\\', '/'),
    text: await readFile(path.join(root, file), 'utf8'),
  })));
}

export async function checkRepositoryPortability({ root }) {
  return findMachinePathFindings(await trackedTextRecords({ root }));
}
```

Create `scripts/check-portability.mjs`:

```js
#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRepositoryPortability } from './lib/portability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const findings = await checkRepositoryPortability({ root });
if (findings.length) {
  for (const item of findings) console.error(`${item.path}:${item.line} [${item.kind}] ${item.match}`);
  console.error(`Portability check failed with ${findings.length} finding(s).`);
  process.exitCode = 1;
} else {
  console.log('Portability check passed.');
}
```

- [ ] **Step 4: Wire the gate into npm and clean all known local paths**

Add `"check:portability": "node scripts/check-portability.mjs"` to `package.json` and make `verify` start with `npm run check:portability &&`.

Apply these content changes:

- in the Windows bootstrap spec, use `<drive>:\Users\<profile>\...` and `file:///<drive>:/...` as generic examples;
- in the Corona plan, use `<workspace>\new admid creds.txt` and state that it remains outside Git;
- in the content migration plan, use `"<legacy-backup>"` for all three source arguments;
- in `design-qa.md`, replace local Codex paths with “external generated design reference (not stored in the repository)” and “ephemeral local QA capture (not stored in the repository)”; retain dimensions and QA conclusions.

- [ ] **Step 5: Run detector and full unit suite**

Run:

```powershell
node --test tests/unit/portability.test.mjs
npm run check:portability
npm test
```

Expected: detector tests PASS, repository reports `Portability check passed.`, existing unit suite PASS.

- [ ] **Step 6: Commit the portability gate**

```powershell
git add package.json scripts/check-portability.mjs scripts/lib/portability.mjs tests/unit/portability.test.mjs docs/superpowers/specs/2026-09-01-iconamaster-windows-bootstrap-design.md docs/superpowers/plans/2026-08-27-iconamaster-corona-integration.md docs/superpowers/plans/2026-08-27-iconamaster-content-migration.md design-qa.md
git commit -m "build: add repository portability gate"
```

---

### Task 2: Core Windows setup and explicit winget installation

**Files:**
- Create: `setup.ps1`
- Create: `tests/windows-setup.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `package.json`, `package-lock.json`, `npm run check:portability`, `npm run verify`, winget IDs `Git.Git` and `OpenJS.NodeJS.LTS`.
- Produces: `Test-NodeVersionPolicy([string]): bool`, `Test-NpmVersionPolicy([string]): bool`, `Get-CoreToolchainState([scriptblock]): object[]`, `Install-CorePrerequisites(object[], [scriptblock]): void`, `Invoke-IconamasterSetup(...): int`; public modes `-CheckOnly` and `-InstallPrerequisites`.

- [ ] **Step 1: Write failing PowerShell policy tests**

Create `tests/windows-setup.test.mjs`:

```js
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const powershell = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const setup = path.join(root, 'setup.ps1').replaceAll("'", "''");

function runPowerShell(command) {
  return spawnSync(powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    cwd: root, encoding: 'utf8', windowsHide: true,
  });
}

test('accepts the declared Node and npm floors', () => {
  const result = runPowerShell(`. '${setup}';
    if (-not (Test-NodeVersionPolicy '20.19.0')) { exit 11 }
    if (Test-NodeVersionPolicy '20.18.9') { exit 12 }
    if (-not (Test-NodeVersionPolicy '22.12.0')) { exit 13 }
    if (Test-NodeVersionPolicy '22.11.0') { exit 14 }
    if (-not (Test-NpmVersionPolicy '10.0.0')) { exit 15 }
    if (Test-NpmVersionPolicy '9.9.9') { exit 16 }`);
  assert.equal(result.status, 0, result.stderr);
});

test('rejects check-only plus installation before doing work', () => {
  const result = spawnSync(powershell, [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'setup.ps1'),
    '-CheckOnly', '-InstallPrerequisites',
  ], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /cannot be used together/iu);
});

test('winget runner is never called unless installation is explicit', () => {
  const result = runPowerShell(`. '${setup}';
    $script:called = $false
    $runner = { param($File, $Arguments) $script:called = $true; return 0 }
    $state = @([pscustomobject]@{ Name='git'; Ready=$false; Found=$null; Required='installed' })
    try { Install-CorePrerequisites $state $runner -Enabled:$false } catch {}
    if ($script:called) { exit 17 }`);
  assert.equal(result.status, 0, result.stderr);
});
```

- [ ] **Step 2: Run the Windows test and verify the entry point is missing**

Run: `node --test tests/windows-setup.test.mjs`

Expected: FAIL because `setup.ps1` does not exist.

- [ ] **Step 3: Implement the core PowerShell functions**

Create `setup.ps1` with this root and testable functions:

```powershell
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
    if (-not $match.Success) { throw "Cannot parse semantic version: $Value" }
    return [version]::new([int]$match.Groups['major'].Value, [int]$match.Groups['minor'].Value, [int]$match.Groups['patch'].Value)
}

function Test-NodeVersionPolicy {
    param([Parameter(Mandatory)][string]$Value)
    $version = ConvertTo-SetupVersion $Value
    if ($version.Major -eq 20) { return $version -ge [version]'20.19.0' }
    if ($version.Major -eq 21) { return $false }
    if ($version.Major -eq 22) { return $version -ge [version]'22.12.0' }
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
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    return $LASTEXITCODE
}
```

Implement `Get-CoreToolchainState` so an injected resolver returns `$null` or an object with `Source`; call `git --version`, `node --version`, and `npm --version` through the injected runner and return `{ Name, Ready, Found, Required }`. Git is ready when present; Node and npm additionally pass their policies.

Implement `Install-CorePrerequisites` with exact package mapping and arguments:

```powershell
$packageIds = @{ git = 'Git.Git'; node = 'OpenJS.NodeJS.LTS'; npm = 'OpenJS.NodeJS.LTS' }
$arguments = @('install', '--exact', '--id', $packageId,
    '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
```

Deduplicate IDs. With `-Enabled:$false`, throw before resolving winget. With installation enabled, require winget, fail on nonzero exit, refresh process PATH from Machine and User scopes, then rerun core checks.

Implement `Test-ProjectMetadata` to require `package.json`, `package-lock.json`, matching root names and lockfile version 3. Implement `Invoke-IconamasterSetup` so it:

1. rejects `-CheckOnly -InstallPrerequisites`;
2. requires `$env:OS -eq 'Windows_NT'`;
3. validates or explicitly installs the core toolchain;
4. validates project metadata;
5. enters `$script:IconamasterProjectRoot` and restores the previous location in `finally`;
6. in check-only mode runs `node scripts/check-portability.mjs` and runs `npm ls --depth=0` only when `node_modules` exists;
7. otherwise runs `npm ci`, `npm run check:portability`, and `npm run verify`;
8. stops on the first nonzero result.

End with:

```powershell
if ($MyInvocation.InvocationName -ne '.') {
    try { exit (Invoke-IconamasterSetup @PSBoundParameters) }
    catch { Write-Error $_.Exception.Message; exit 1 }
}
```

- [ ] **Step 4: Declare package versions and setup tests**

Add to `package.json`:

```json
"packageManager": "npm@10.8.2",
"engines": { "node": "^20.19.0 || >=22.12.0", "npm": ">=10" }
```

Add `"test:setup": "node --test tests/windows-setup.test.mjs"` and include it in `verify`. Run `npm install --package-lock-only --ignore-scripts` and verify the lockfile root contains the same engines.

- [ ] **Step 5: Run setup tests and check-only mode**

```powershell
node --test tests/windows-setup.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -CheckOnly
npm run check:portability
```

Expected: tests PASS; check-only reports versions without `npm ci`; portability PASS.

- [ ] **Step 6: Commit the core setup**

```powershell
git add setup.ps1 tests/windows-setup.test.mjs package.json package-lock.json
git commit -m "build: add hybrid Windows setup"
```

---

### Task 3: Optional deployment and migration checks

**Files:**
- Modify: `setup.ps1`
- Modify: `tests/windows-setup.test.mjs`

**Interfaces:**
- Consumes: `-ForDeployment`, `-ForMigration`, `tests/fixtures/migration/editorial-cover-assets.json`.
- Produces: `Get-DeploymentToolState([scriptblock]): object[]`, `Compare-FfmpegIdentity(object, object): object`, `Test-MigrationToolchain([scriptblock], [scriptblock]): object`.

- [ ] **Step 1: Write failing optional-mode tests**

Append:

```js
test('deployment mode requires ssh scp and tar as a separate tool group', () => {
  const result = runPowerShell(`. '${setup}';
    $resolver = { param($Name) if ($Name -in @('ssh','tar')) { [pscustomobject]@{ Source=$Name } } }
    $state = Get-DeploymentToolState $resolver
    if (($state | Where-Object Name -eq 'scp').Ready) { exit 21 }
    if (-not ($state | Where-Object Name -eq 'ssh').Ready) { exit 22 }
    if (-not ($state | Where-Object Name -eq 'tar').Ready) { exit 23 }`);
  assert.equal(result.status, 0, result.stderr);
});

test('migration mode rejects checksum and version drift', () => {
  const result = runPowerShell(`. '${setup}';
    $expected = [pscustomobject]@{ binarySha256='${'a'.repeat(64)}'; versionLine='ffmpeg version pinned' }
    $actual = [pscustomobject]@{ binarySha256='${'b'.repeat(64)}'; versionLine='ffmpeg version other' }
    $state = Compare-FfmpegIdentity -Expected $expected -Actual $actual
    if ($state.Ready) { exit 24 }
    if ($state.Reasons.Count -ne 2) { exit 25 }`);
  assert.equal(result.status, 0, result.stderr);
});
```

- [ ] **Step 2: Run tests and verify optional functions are absent**

Run: `node --test tests/windows-setup.test.mjs`

Expected: FAIL because `Get-DeploymentToolState` and `Compare-FfmpegIdentity` are undefined.

- [ ] **Step 3: Implement deployment checks without installation**

`Get-DeploymentToolState` resolves `ssh`, `scp`, and `tar` and returns `{ Name, Ready, Found, Required }`. If requested tools are missing, fail with:

```text
OpenSSH Client: Settings > System > Optional features > Add an optional feature > OpenSSH Client
tar: install or repair the Windows BSD tar component, then reopen PowerShell
```

Do not invoke winget, `Add-WindowsCapability`, SSH, SCP, tar, or MTW from this check.

- [ ] **Step 4: Implement exact FFmpeg identity verification**

Implement `Compare-FfmpegIdentity` as a pure `{ Ready, Reasons }` comparison. `Test-MigrationToolchain` must:

1. read the fixture from `$script:IconamasterProjectRoot`;
2. resolve `ffmpeg` without downloading it;
3. hash the executable with `Get-FileHash -Algorithm SHA256`;
4. run `ffmpeg -version` through the injected runner and take its first output line;
5. compare lowercase SHA-256 and exact `versionLine`;
6. report the fixture and mismatch kinds only.

Call optional checks before `npm ci` and only for requested flags.

- [ ] **Step 5: Run focused and real-environment checks**

```powershell
node --test tests/windows-setup.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -CheckOnly -ForDeployment
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -CheckOnly -ForMigration
```

Expected: tests PASS. Deployment either PASSes or gives the safe documented remedy and never connects. Migration PASSes only for the exact pinned FFmpeg; otherwise it gives a controlled nonzero checksum/version diagnostic.

- [ ] **Step 6: Commit optional checks**

```powershell
git add setup.ps1 tests/windows-setup.test.mjs
git commit -m "build: check optional Windows deployment tools"
```

---

### Task 4: Quick-start documentation and clean path-with-spaces test

**Files:**
- Create: `README.md`
- Create: `docs/windows-setup.md`
- Modify: `tests/windows-setup.test.mjs`

**Interfaces:**
- Consumes: public flags and version floors from Tasks 2–3.
- Produces: quick start, troubleshooting guide, clean-copy test.

- [ ] **Step 1: Write failing documentation and clean-copy tests**

Add imports for `cp`, `mkdtemp`, `readFile`, `rm`, and `tmpdir`, then:

```js
test('README documents the three safe setup entry points', async () => {
  const readme = await readFile(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /\.\\setup\.ps1\b/u);
  assert.match(readme, /\.\\setup\.ps1 -CheckOnly\b/u);
  assert.match(readme, /\.\\setup\.ps1 -InstallPrerequisites\b/u);
  assert.match(readme, /Node\.js.*20\.19\.0.*22\.12\.0/su);
  assert.match(readme, /секреты.*вне Git/iu);
});
```

Add an integration test that creates a temporary directory with spaces, copies `setup.ps1`, package files and portability scripts, runs `git init` and `git add` via `spawnSync` argument arrays, launches `setup.ps1 -CheckOnly` from the parent, and asserts:

```js
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
assert.equal(await exists(path.join(copyRoot, 'node_modules')), false);
```

Use `try/finally` with `rm(tempRoot, { recursive: true, force: true })`.

- [ ] **Step 2: Run tests and verify README is missing**

Run: `node --test tests/windows-setup.test.mjs`

Expected: FAIL with `ENOENT` for `README.md`.

- [ ] **Step 3: Write concise root README**

Create `README.md` with:

1. `# Iconamaster.ru` and project purpose;
2. clone, `cd`, `.\setup.ps1` quick start;
3. exact commands for `-CheckOnly`, `-InstallPrerequisites`, `-ForDeployment`, `-ForMigration`;
4. Windows 10/11, PowerShell 5.1+, Git, Node.js `^20.19.0 || >=22.12.0`, npm 10+;
5. `npm run dev`, `npm run verify`, `npm run build:mtw`, `npm run check:portability`;
6. secrets outside Git, setup does not deploy, GitHub push precedes MTW;
7. link to `docs/windows-setup.md`.

- [ ] **Step 4: Write detailed Windows guide**

Create `docs/windows-setup.md` with flag behavior, winget IDs, Microsoft App Installer guidance, OpenSSH Optional Features path, tar diagnostics, pinned FFmpeg fixture, PATH restart guidance, normal local `node_modules`, secrets outside Git, and this one-process policy workaround:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1 -CheckOnly
```

- [ ] **Step 5: Run documentation, clean-copy and portability checks**

```powershell
node --test tests/windows-setup.test.mjs
npm run check:portability
git diff --check
```

Expected: setup tests PASS including path-with-spaces and absent `node_modules`; portability PASS; no whitespace errors.

- [ ] **Step 6: Commit documentation and integration coverage**

```powershell
git add README.md docs/windows-setup.md tests/windows-setup.test.mjs
git commit -m "docs: add Windows setup guide"
```

---

### Task 5: Full verification, clean installation and GitHub update

**Files:**
- Verify only; production files must not change.

**Interfaces:**
- Consumes: committed Tasks 1–4 and remote `origin`.
- Produces: verified clean install and updated GitHub `main`; no deployment.

- [ ] **Step 1: Confirm clean worktree**

```powershell
git status --short
git log -5 --oneline
```

Expected: no status output; spec and implementation commits visible.

- [ ] **Step 2: Run complete verification**

Run: `npm run verify`

Expected: portability, unit, content, asset, Sites and MTW packaging tests all PASS.

- [ ] **Step 3: Create a clean local clone in a path with spaces**

```powershell
$bootstrapAuditRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("Iconamaster clean setup " + [guid]::NewGuid().ToString('N'))
git clone --no-local . $bootstrapAuditRoot
```

Print the target before continuing; never reuse an existing directory.

- [ ] **Step 4: Verify read-only setup**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $bootstrapAuditRoot 'setup.ps1') -CheckOnly
Test-Path -LiteralPath (Join-Path $bootstrapAuditRoot 'node_modules')
```

Expected: PASS and `False`.

- [ ] **Step 5: Verify full default setup**

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $bootstrapAuditRoot 'setup.ps1')
$nodeModules = Get-Item -LiteralPath (Join-Path $bootstrapAuditRoot 'node_modules') -Force
$nodeModules.Attributes
$nodeModules.LinkType
```

Expected: `npm ci` and verification PASS; `node_modules` is a normal directory and `LinkType` is empty.

- [ ] **Step 6: Remove only the verified temporary clone**

```powershell
$resolvedAuditRoot = (Resolve-Path -LiteralPath $bootstrapAuditRoot).Path
$resolvedTempRoot = (Resolve-Path -LiteralPath ([System.IO.Path]::GetTempPath())).Path.TrimEnd('\\')
if (-not $resolvedAuditRoot.StartsWith($resolvedTempRoot + '\\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove non-temp path: $resolvedAuditRoot"
}
Remove-Item -LiteralPath $resolvedAuditRoot -Recurse -Force
```

Expected: only the new temporary clone is removed.

- [ ] **Step 7: Reconfirm source and push GitHub main**

```powershell
git status --short
npm run check:portability
git push origin HEAD:main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: clean worktree, portability PASS, successful push, identical local and remote hashes.

- [ ] **Step 8: Report without deploying**

Report versions, full verification, clean-clone result, normal `node_modules`, local/remote hash, and explicit confirmation that neither `iconamaster.ru` nor Sites was published.
