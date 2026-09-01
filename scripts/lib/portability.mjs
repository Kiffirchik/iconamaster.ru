import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const textExtensions = new Set([
  '.css', '.html', '.js', '.jsx', '.json', '.md', '.mjs', '.ps1',
  '.toml', '.txt', '.yaml', '.yml',
]);
const textNames = new Set(['.gitattributes', '.gitignore', '.htaccess', '.npmrc']);
const patterns = [
  { kind: 'windows-user-profile', expression: /(?<!file:\/\/)(?<!file:\/\/\/)[a-z]:(?:\\+|\/)Users(?:\\+|\/)[^\\/\s`"']+/giu },
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
