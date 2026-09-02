import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const textExtensions = new Set([
  '.css', '.html', '.js', '.jsx', '.json', '.md', '.mjs', '.ps1',
  '.toml', '.txt', '.yaml', '.yml',
]);
const textNames = new Set(['.gitattributes', '.gitignore', '.htaccess', '.npmrc']);
const patterns = [
  { kind: 'windows-user-profile', expression: /(?<!file:\/\/)(?<!file:\/\/\/)(?<![a-z])[a-z]:(?:\\+|\/)Users(?:\\+|\/)[^\\/\s`"']+/giu },
  { kind: 'legacy-windows-profile', expression: /(?<!file:\/\/)(?<!file:\/\/\/)(?<![a-z])[a-z]:(?:\\+|\/)Documents and Settings(?:\\+|\/)[^\\/\s`"']+/giu },
  { kind: 'windows-file-url', expression: /file:\/{2,3}[a-z]:\//giu },
  // Profile paths have dedicated findings above; this catches other concrete drive-rooted paths.
  { kind: 'windows-drive-root', expression: /(?<!file:\/\/)(?<!file:\/\/\/)(?<![a-z])(?!x:\/resource(?:[\/\s`"'<>]|$))[a-z]:(?:\\+|\/)(?!\/)(?!(?:Users|Documents and Settings)(?:\\+|\/))[^\\/\s`"'<>]+(?:(?:\\+|\/)[^\\/\s`"'<>]+)*/giu },
  // These profile/temp variables still bind operational files to one Windows account or machine.
  { kind: 'windows-profile-environment', expression: /%(?:LOCALAPPDATA|APPDATA|USERPROFILE|TEMP|TMP)%(?:\\+|\/)[^\\/\s`"'<>]+(?:(?:\\+|\/)[^\\/\s`"'<>]+)*/giu },
  { kind: 'windows-profile-environment', expression: /(?:\$env:(?:LOCALAPPDATA|APPDATA|USERPROFILE|TEMP|TMP)(?![a-z0-9_])|\$\{env:(?:LOCALAPPDATA|APPDATA|USERPROFILE|TEMP|TMP)\})(?:(?:\\+|\/)[^\\/\s`"'<>]+)*/giu },
];
// Only commands that consume filesystem operands make a parent path an operational dependency.
const operationalParentContexts = [
  /\b(?:Copy-Item|Move-Item|Set-Location)\b/iu,
  /(?:^|[^\p{L}\p{N}_])copy\s*\(/iu,
];
const parentPathExpression = /(?<!\.)\.\.(?:\\+|\/)[^\\/\s`"'<>()[\]{},;]+(?:(?:\\+|\/)[^\\/\s`"'<>()[\]{},;]+)*/gu;
const runtimeRootExpression = /\$(?:PSScriptRoot|\{PSScriptRoot\})(?:\\+|\/)$/iu;

function findOperationalParentDependencies({ path: filePath, text }) {
  return text.split(/\r?\n/u).flatMap((line, lineIndex) => {
    parentPathExpression.lastIndex = 0;
    return [...line.matchAll(parentPathExpression)].flatMap((match) => {
      const prefix = line.slice(0, match.index);
      const isOperational = operationalParentContexts.some((expression) => expression.test(prefix));
      if (!isOperational || runtimeRootExpression.test(prefix)) return [];
      return [{
        path: filePath,
        kind: 'windows-parent-dependency',
        match: match[0],
        line: lineIndex + 1,
      }];
    });
  });
}

export function findMachinePathFindings(records) {
  return records.flatMap((record) => [
    ...patterns.flatMap(({ kind, expression }) => {
      expression.lastIndex = 0;
      return [...record.text.matchAll(expression)].map((match) => ({
        path: record.path,
        kind,
        match: match[0],
        line: record.text.slice(0, match.index).split(/\r?\n/u).length,
      }));
    }),
    ...findOperationalParentDependencies(record),
  ]);
}

function gitTrackedFiles(root) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['-c', 'core.quotepath=false', 'ls-files', '--stage', '-z'], {
      cwd: root, windowsHide: true,
    });
    const chunks = [];
    const errors = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => code === 0
      ? resolve(Buffer.concat(chunks).toString('utf8').split('\0').filter(Boolean).map((entry) => {
        const pathSeparator = entry.indexOf('\t');
        return {
          mode: entry.slice(0, entry.indexOf(' ')),
          file: entry.slice(pathSeparator + 1),
        };
      }))
      : reject(new Error(Buffer.concat(errors).toString('utf8').trim() || `git ls-files exited ${code}`)));
  });
}

export async function trackedTextRecords({ root }) {
  const files = await gitTrackedFiles(root);
  const selected = files.filter(({ file, mode }) => mode !== '120000'
    && (textNames.has(path.basename(file)) || textExtensions.has(path.extname(file))));
  const records = await Promise.all(selected.map(async ({ file }) => {
    const filePath = path.join(root, file);
    if ((await lstat(filePath)).isSymbolicLink()) return null;
    return {
      path: file.replaceAll('\\', '/'),
      text: await readFile(filePath, 'utf8'),
    };
  }));
  return records.filter(Boolean);
}

export async function checkRepositoryPortability({ root }) {
  return findMachinePathFindings(await trackedTextRecords({ root }));
}
