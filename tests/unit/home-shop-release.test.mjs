import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('shop release replaces only approved pages and preserves live content and unrelated HTML', async t => {
  const { prepareHomeShopRelease } = await import('../../scripts/package-home-shop-release.mjs');
  const root = await mkdtemp(path.join(tmpdir(), 'shop-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file, text) => { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), text); };
  const old = '<script src="/assets/index-old.js"></script><link href="/assets/index-old.css">';
  const current = '<script src="/assets/index-new.js"></script><link href="/assets/index-new.css">';
  const routes = { '/': 'home.html', '/collection': 'collection.html' };
  for (const route of ['index.html', 'collection/index.html', '.live-templates/home.html', '.live-templates/collection.html']) {
    await put('live/' + route, old + 'Previous page');
    await put('build/' + route, current + 'Approved shop');
  }
  for (const kind of ['live', 'build']) {
    await put(kind + '/.live-templates/routes.json', JSON.stringify(routes));
    await put(kind + '/content/icons.json', '[{"slug":"hidden","published":false,"title":"Live editor price and text"}]');
  }
  await put('live/.live-templates/collection.html', old + '<!--VISIBLE:hidden--><article>Hidden restore card</article><!--/VISIBLE:hidden-->');
  await put('build/.live-templates/collection.html', current + '<!--VISIBLE:shown--><article>New visible card</article><!--/VISIBLE:shown-->');
  await put('live/articles/example/index.html', old + 'Owner edited article <script>preserved()</script>');
  await put('build/articles/example/index.html', current + 'STALE article');
  await put('build/assets/index-new.js', 'js');
  await put('build/assets/index-new.css', 'css');
  await put('build/assets/workshop/blessing-2007.jpeg', 'original photo bytes');
  const args = { baselineRoot: path.join(root, 'live'), buildRoot: path.join(root, 'build'), outputRoot: path.join(root, 'out') };
  const result = await prepareHomeShopRelease(args);
  assert.equal(result.htmlCount, 5);
  assert.equal(await readFile(path.join(root, 'out/site/index.html'), 'utf8'), current + 'Approved shop');
  assert.equal(await readFile(path.join(root, 'out/site/.live-templates/home.html'), 'utf8'), current + 'Approved shop');
  assert.equal(await readFile(path.join(root, 'out/site/.live-templates/collection.html'), 'utf8'), current + '<!--VISIBLE:shown--><article>New visible card</article><!--/VISIBLE:shown--><!--VISIBLE:hidden--><article>Hidden restore card</article><!--/VISIBLE:hidden-->');
  assert.equal(await readFile(path.join(root, 'out/site/articles/example/index.html'), 'utf8'), current + 'Owner edited article <script>preserved()</script>');
  assert.equal(await readFile(path.join(root, 'out/site/assets/workshop/blessing-2007.jpeg'), 'utf8'), 'original photo bytes');
  assert.ok(!(await readdir(path.join(root, 'out/site'))).includes('content'));
  assert.match(await readFile(path.join(root, 'out/before.sha256'), 'utf8'), /content\/icons.json/);
  assert.doesNotMatch(await readFile(path.join(root, 'out/after.sha256'), 'utf8'), /content\//);
  await assert.rejects(prepareHomeShopRelease(args), { code: 'EEXIST' });
  await put('build/content/icons.json', '[]');
  await assert.rejects(prepareHomeShopRelease({ ...args, outputRoot: path.join(root, 'different-content') }), /Content differs/);
});
