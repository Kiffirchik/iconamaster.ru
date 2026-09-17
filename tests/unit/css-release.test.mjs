import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('CSS overlay preserves live edits and scripts, excludes editable data, and rejects stale output', async t => {
  const { prepareCssRelease } = await import('../../scripts/package-css-release.mjs');
  const root = await mkdtemp(path.join(tmpdir(), 'css-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file, text) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), text);
  };
  const live = '<link href="/assets/index-old.css"><script src="/assets/index-live.js"></script>Live edit';
  await put('live/index.html', live);
  await put('live/.live-templates/article.html', live);
  await put('live/content/articles.json', 'Owner data');
  await put('build/index.html', '<link href="/assets/index-new.css">Stale repo text');
  await put('build/assets/index-new.css', 'new styles');
  const args = { baselineRoot: path.join(root, 'live'), buildRoot: path.join(root, 'build'), outputRoot: path.join(root, 'out') };
  const result = await prepareCssRelease(args);
  assert.equal(result.htmlCount, 2);
  assert.equal(await readFile(path.join(root, 'out/site/index.html'), 'utf8'), '<link href="/assets/index-new.css"><script src="/assets/index-live.js"></script>Live edit');
  assert.equal(await readFile(path.join(root, 'out/site/.live-templates/article.html'), 'utf8'), '<link href="/assets/index-new.css"><script src="/assets/index-live.js"></script>Live edit');
  assert.deepEqual((await readdir(path.join(root, 'out/site'))).sort(), ['.live-templates', 'assets', 'index.html']);
  await assert.rejects(prepareCssRelease(args), { code: 'EEXIST' });
});
