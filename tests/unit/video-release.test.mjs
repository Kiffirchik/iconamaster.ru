import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('video release rejects a reused output directory before preparing an overlay', async t => {
  const { prepareVideoRelease } = await import('../../scripts/package-videos-20260917.mjs');
  const root = await mkdtemp(path.join(tmpdir(), 'video-stale-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'stale.html'), 'Do not publish');
  await assert.rejects(prepareVideoRelease({ baselineRoot: path.join(root, 'no-baseline'), buildRoot: path.join(root, 'no-build'), outputRoot: root }), { code: 'EEXIST' });
  assert.equal(await readFile(path.join(root, 'stale.html'), 'utf8'), 'Do not publish');
});

test('video release preserves live HTML text and changes only bundle references outside the two intended pages', async t => {
  const { prepareVideoRelease } = await import('../../scripts/package-videos-20260917.mjs');
  const root = await mkdtemp(path.join(tmpdir(), 'video-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file, text) => { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), text); };
  const assets = '<script src="/assets/index-old.js"></script><link href="/assets/index-old.css">';
  const updated = '<script src="/assets/index-new.js"></script><link href="/assets/index-new.css">';
  await put('live/index.html', assets + 'Текст, исправленный владельцем');
  await put('live/video/index.html', assets + 'Старые видео');
  await put('live/articles/icon-painting-pigments/index.html', assets + 'Старая статья');
  await put('live/.live-templates/pigments.html', assets + '<!--LIVE:article-sections:icon-painting-pigments-->');
  await put('live/content/videos.json', '[]');
  await put('build/index.html', updated + 'Репозиторный текст — нельзя копировать');
  await put('build/video/index.html', updated + 'Новые видео');
  await put('build/articles/icon-painting-pigments/index.html', updated + 'Ссылка на видео');
  await put('build/.live-templates/pigments.html', updated + '<!--LIVE:article-sections:icon-painting-pigments-->Ссылка');
  await put('build/.live-templates/routes.json', JSON.stringify({ '/articles/icon-painting-pigments': 'pigments.html' }));
  await put('build/content/videos.json', '[]');
  await put('build/assets/index-new.js', 'js');
  await put('build/assets/index-new.css', 'css');
  await prepareVideoRelease({ baselineRoot: path.join(root, 'live'), buildRoot: path.join(root, 'build'), outputRoot: path.join(root, 'out') });
  const html = await readFile(path.join(root, 'out/site/index.html'), 'utf8');
  assert.equal(html, updated + 'Текст, исправленный владельцем');
  assert.match(await readFile(path.join(root, 'out/site/video/index.html'), 'utf8'), /Новые видео/);
  assert.match(await readFile(path.join(root, 'out/before.sha256'), 'utf8'), /content\/videos.json/);
  assert.match(await readFile(path.join(root, 'out/after.sha256'), 'utf8'), /assets\/index-new.js/);
});
