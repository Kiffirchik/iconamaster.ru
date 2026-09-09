import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
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
const importerSource = path.join(projectRoot, 'scripts', 'import-docx-articles-september-2.py');
const fixtureBuilder = path.join(projectRoot, 'tests', 'fixtures', 'docx-importer', 'build-fixtures.py');
const expectedBaselineSlugs = [
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

async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function createProjectFixture(context, { mode = 'valid', validEditorial = true } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'iconamaster-docx-importer-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const incoming = path.join(root, 'incoming');
  const importer = path.join(root, 'scripts', 'import-docx-articles-september-2.py');
  const baseline = path.join(root, 'baseline.json');
  await Promise.all([
    mkdir(path.dirname(importer), { recursive: true }),
    mkdir(path.join(root, 'reports'), { recursive: true }),
    mkdir(path.join(root, 'public', 'content'), { recursive: true }),
  ]);
  await copyFile(importerSource, importer);
  await writeFile(baseline, `${JSON.stringify(expectedBaselineSlugs.map((slug, index) => ({
    id: slug,
    slug,
    order: index + 1,
  })), null, 2)}\n`);
  await writeFile(path.join(root, 'reports', 'docx-import.json'), `${JSON.stringify({
    schemaVersion: 1,
    source: 'test fixture',
    assets: [],
    documents: [],
  }, null, 2)}\n`);
  await writeFile(path.join(root, 'reports', 'editorial-migration.json'), `${JSON.stringify({
    outputs: validEditorial ? [{ path: 'public/content/articles.json' }] : [],
    summary: { records: { articles: 12 } },
  }, null, 2)}\n`);

  const runtime = await pythonCommand();
  await execFileAsync(runtime.command, [
    ...runtime.prefix,
    fixtureBuilder,
    '--output',
    incoming,
    '--mode',
    mode,
  ]);
  return { root, incoming, importer, baseline, runtime };
}

async function runImporter(fixture) {
  return execFileAsync(fixture.runtime.command, [
    ...fixture.runtime.prefix,
    fixture.importer,
    '--incoming',
    fixture.incoming,
    '--baseline',
    fixture.baseline,
  ], { cwd: fixture.root, maxBuffer: 10 * 1024 * 1024 });
}

function articleProse(article) {
  return article.sections.flatMap((section) => section.type === 'text'
    ? [...(section.heading ? [section.heading] : []), ...section.paragraphs]
    : []);
}

test('DOCX importer preserves w:tab as a visible text separator', async (context) => {
  const fixture = await createProjectFixture(context);
  await runImporter(fixture);
  const articles = await json(path.join(fixture.root, 'public', 'content', 'articles.json'));
  const prose = articleProse(articles.find(({ slug }) => slug === 'vetka-icon-painting'));

  assert.ok(prose.includes('• Декоративность'));
  assert.ok(!prose.includes('•Декоративность'));
});

test('DOCX importer removes the debris marker only as the Vetka terminal suffix', async (context) => {
  const fixture = await createProjectFixture(context);
  await runImporter(fixture);
  const articles = await json(path.join(fixture.root, 'public', 'content', 'articles.json'));
  const vetka = articleProse(articles.find(({ slug }) => slug === 'vetka-icon-painting'));
  const palekh = articleProse(articles.find(({ slug }) => slug === 'palekh-icon-painting'));

  assert.ok(vetka.includes('Удалить только суффикс'));
  assert.ok(vetka.includes('Сохранить elib.rshu.ru +1 внутри строки'));
  assert.ok(palekh.includes('Чужой суффикс elib.rshu.ru +1'));
});

test('DOCX importer rejects VML style and attribute rotations', async (context) => {
  for (const mode of ['vml-style-rotation', 'vml-attribute-rotation']) {
    const fixture = await createProjectFixture(context, { mode });
    await assert.rejects(runImporter(fixture), /VML rotation requires explicit handling/u);
  }
});

test('invalid editorial report leaves no partial importer output', async (context) => {
  const fixture = await createProjectFixture(context, { validEditorial: false });
  const reportPath = path.join(fixture.root, 'reports', 'docx-import.json');
  const reportBefore = await readFile(reportPath, 'utf8');

  await assert.rejects(runImporter(fixture), /Editorial report does not describe/u);

  assert.equal(await readFile(reportPath, 'utf8'), reportBefore);
  await assert.rejects(
    readFile(path.join(fixture.root, 'public', 'content', 'articles.json')),
    { code: 'ENOENT' },
  );
  const assetsRoot = path.join(fixture.root, 'public', 'assets', 'articles', 'docx');
  assert.deepEqual(await readdir(assetsRoot).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  }), []);
});
