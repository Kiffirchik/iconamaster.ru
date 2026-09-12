import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const coreImporterSource = path.join(projectRoot, 'scripts', 'import-docx-articles-september-2.py');
const importerSource = path.join(projectRoot, 'scripts', 'import-docx-articles-september-3.py');
const fixtureBuilder = path.join(projectRoot, 'tests', 'fixtures', 'docx-importer', 'build-fixtures.py');
const baselineSlugs = [
  'vetka-icon-painting',
  'palekh-icon-painting',
  'peshekhonov-icon-painting',
  'history-of-cast-icons',
  'cast-crosses',
  'gorbunov-icons-kholuy',
  'kineshma-icon-painting',
  'panteleimon-monastery-icons',
  'theotokos-russkaya',
  'pavlovo-na-oke',
  'history-of-icon-oklads',
  'icon-painting-canon',
  'guslitsa',
  'restoration-murals-cleaning',
  'georgievsky-church-iconostasis',
];

let python;

async function pythonCommand() {
  if (python) return python;
  const executableName = process.platform === 'win32' ? 'python.exe' : 'bin/python3';
  const profileRuntime = process.env.USERPROFILE && path.join(
    process.env.USERPROFILE,
    '.cache',
    'codex-runtimes',
    'codex-primary-runtime',
    'dependencies',
    'python',
    executableName,
  );
  const candidates = [
    process.env.ICONAMASTER_PYTHON && { command: process.env.ICONAMASTER_PYTHON, prefix: [] },
    profileRuntime && { command: profileRuntime, prefix: [] },
    { command: 'python3', prefix: [] },
    { command: 'python', prefix: [] },
    ...(process.platform === 'win32' ? [{ command: 'py', prefix: ['-3'] }] : []),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate.command).catch(() => {});
      await execFileAsync(candidate.command, [...candidate.prefix, '-c', 'import lxml, PIL']);
      python = candidate;
      return python;
    } catch {
      // Try the next supported Python launcher.
    }
  }
  throw new Error('Python with lxml and Pillow is required for DOCX importer tests');
}

function imagesIn(article) {
  return article.sections.flatMap((section) => {
    if (section.type === 'image') return [section.image];
    if (section.type === 'gallery') return section.images;
    return [];
  });
}

function proseIn(article) {
  return article.sections.flatMap((section) => section.type === 'text'
    ? [...(section.heading ? [section.heading] : []), ...section.paragraphs]
    : []);
}

test('third DOCX batch preserves the live baseline, removes editorial markers, and reuses repeated source images', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'iconamaster-docx-importer-3-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const incoming = path.join(root, 'incoming');
  const scripts = path.join(root, 'scripts');
  const reports = path.join(root, 'reports');
  const content = path.join(root, 'public', 'content');
  const baselinePath = path.join(root, 'baseline.json');
  const baseline = baselineSlugs.map((slug, index) => ({ id: slug, slug, order: index + 1 }));
  await Promise.all([
    mkdir(scripts, { recursive: true }),
    mkdir(reports, { recursive: true }),
    mkdir(content, { recursive: true }),
  ]);
  await Promise.all([
    copyFile(coreImporterSource, path.join(scripts, 'import-docx-articles-september-2.py')),
    copyFile(importerSource, path.join(scripts, 'import-docx-articles-september-3.py')),
    writeFile(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`),
    writeFile(path.join(reports, 'docx-import.json'), `${JSON.stringify({ schemaVersion: 1, assets: [], documents: [] }, null, 2)}\n`),
    writeFile(path.join(reports, 'editorial-migration.json'), `${JSON.stringify({
      outputs: [{ path: 'public/content/articles.json' }],
      summary: { records: { articles: 15 } },
    }, null, 2)}\n`),
  ]);
  const runtime = await pythonCommand();
  await execFileAsync(runtime.command, [
    ...runtime.prefix,
    fixtureBuilder,
    '--output', incoming,
    '--batch', '3',
  ]);
  await execFileAsync(runtime.command, [
    ...runtime.prefix,
    path.join(scripts, 'import-docx-articles-september-3.py'),
    '--incoming', incoming,
    '--baseline', baselinePath,
  ], { cwd: root, maxBuffer: 10 * 1024 * 1024 });

  const firstArticlesBytes = await readFile(path.join(content, 'articles.json'));
  const firstReportBytes = await readFile(path.join(reports, 'docx-import.json'));
  await execFileAsync(runtime.command, [
    ...runtime.prefix,
    path.join(scripts, 'import-docx-articles-september-3.py'),
    '--incoming', incoming,
    '--baseline', baselinePath,
  ], { cwd: root, maxBuffer: 10 * 1024 * 1024 });
  assert.deepEqual(await readFile(path.join(content, 'articles.json')), firstArticlesBytes);
  assert.deepEqual(await readFile(path.join(reports, 'docx-import.json')), firstReportBytes);

  const articles = JSON.parse(await readFile(path.join(content, 'articles.json'), 'utf8'));
  const report = JSON.parse(await readFile(path.join(reports, 'docx-import.json'), 'utf8'));
  assert.equal(articles.length, 18);
  assert.deepEqual(articles.slice(3), baseline);
  assert.deepEqual(articles.slice(0, 3).map(({ slug }) => slug), [
    'moscow-icon-painting-school',
    'authentic-hallmarks-precious-metals',
    'history-assay-hallmarks',
  ]);
  assert.equal(
    articles[1].title,
    'Признаки подлинных клейм используемых для защиты от фальсификации предметов из драгоценных металлов',
  );
  assert.deepEqual(articles.slice(0, 3).map((article) => imagesIn(article).length), [5, 50, 16]);
  assert.equal(new Set(imagesIn(articles[2]).map(({ src }) => src)).size, 13);
  assert.match(articles[2].image.src, /^\/assets\/articles\/docx\/history-assay-hallmarks-3\.(?:jpg|png)$/u);
  assert.equal(report.assets.length, 68);
  assert.equal(report.documents.length, 3);
  assert.doesNotMatch(proseIn(articles[1]).join('\n'), /(?:создать|созать|здать)(?:\s+карусель|\s*$|\s+голландский)/iu);
  assert.ok(proseIn(articles[1]).includes('Содержательный абзац.'));
});
