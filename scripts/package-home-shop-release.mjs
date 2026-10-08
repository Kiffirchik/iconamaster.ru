// Publish the approved home/collection UI while preserving live edited pages.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => readFile(file, 'utf8');
const assetRefs = html => ['js', 'css'].map(ext => {
  const match = html.match(new RegExp('/assets/(index-[A-Za-z0-9_-]+\\.' + ext + ')'));
  assert.ok(match, 'Missing built ' + ext);
  return match[0];
});

export async function prepareHomeShopRelease({ baselineRoot, buildRoot, outputRoot, approvedRoutes = ['/', '/collection'], approvedArticlePrefix = null }) {
  await mkdir(path.dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot); // Fail closed if a payload already exists.
  const oldRefs = assetRefs(await read(path.join(baselineRoot, 'index.html')));
  const newRefs = assetRefs(await read(path.join(buildRoot, 'index.html')));
  const before = [], after = [];
  let approvedArticleBytes;
  for (const name of await readdir(path.join(baselineRoot, 'content'))) {
    if (!name.endsWith('.json')) continue;
    const relative = 'content/' + name;
    const bytes = await readFile(path.join(baselineRoot, relative));
    const builtBytes = await readFile(path.join(buildRoot, relative));
    const built = JSON.parse(builtBytes), live = JSON.parse(bytes);
    if (relative === 'content/articles.json' && approvedArticlePrefix) {
      const target = built.find(article => article.slug === 'icon-painting-pigments');
      assert.ok(target, 'Missing pigments article');
      assert.deepEqual(target.sections[0], approvedArticlePrefix, 'Unapproved article introduction');
      const withoutPrefix = built.map(article => article === target ? { ...article, sections: article.sections.slice(1) } : article);
      assert.deepEqual(withoutPrefix, live, 'Content differs beyond approved article introduction');
      approvedArticleBytes = builtBytes;
    } else {
      assert.deepEqual(built, live, 'Content differs: ' + relative);
    }
    before.push(hash(bytes) + '  ' + relative);
  }
  const liveRouteBytes = await readFile(path.join(baselineRoot, '.live-templates/routes.json'));
  const liveRoutes = JSON.parse(liveRouteBytes);
  before.push(hash(liveRouteBytes) + '  .live-templates/routes.json');
  const routes = JSON.parse(await read(path.join(buildRoot, '.live-templates/routes.json')));
  for (const route of approvedRoutes) {
    assert.match(route, /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/);
    assert.equal(routes[route], liveRoutes[route], 'Live route mapping differs: ' + route);
    assert.match(routes[route], /^[a-zA-Z0-9-]+\.html$/);
  }
  const replacements = new Set(approvedRoutes.flatMap(route => [route === '/' ? 'index.html' : route.slice(1) + '/index.html', '.live-templates/' + routes[route]]));
  const icons = JSON.parse(await read(path.join(baselineRoot, 'content/icons.json')));
  let htmlCount = 0;
  const write = async (relative, bytes) => {
    assert.ok(!relative.includes('..') && !path.isAbsolute(relative) && !relative.includes('\\'));
    const target = path.join(outputRoot, 'site', relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    after.push(hash(bytes) + '  ' + relative);
  };
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      assert.ok(!entry.isSymbolicLink(), 'Unexpected linked file: ' + relative);
      if (entry.isDirectory()) { await walk(path.join(dir, entry.name), relative + '/'); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
      const bytes = await readFile(path.join(dir, entry.name));
      const original = bytes.toString('utf8');
      if (!oldRefs.some(ref => original.includes(ref))) continue;
      assert.ok(oldRefs.every(ref => original.includes(ref)), 'Partial old bundle references: ' + relative);
      let updated = original;
      for (let index = 0; index < oldRefs.length; index++) updated = updated.replaceAll(oldRefs[index], newRefs[index]);
      if (replacements.has(relative)) {
        updated = await read(path.join(buildRoot, relative));
        if (approvedRoutes.includes('/collection') && relative === '.live-templates/' + routes['/collection']) {
          // Hidden records must remain restorable by Corona without rebuilding.
          const retained = [];
          for (const icon of icons) {
            assert.match(icon.slug, /^[a-z0-9-]+$/);
            if (updated.includes('<!--VISIBLE:' + icon.slug + '-->')) continue;
            assert.ok(!icon.published || !icon.images?.length, 'Missing visible icon: ' + icon.slug);
            const block = original.match(new RegExp('<!--VISIBLE:' + icon.slug + '-->[\\s\\S]*?<!--/VISIBLE:' + icon.slug + '-->'));
            assert.ok(block, 'Missing restorable live icon: ' + icon.slug);
            retained.push(block[0]);
          }
          if (retained.length) {
            const ends = [...updated.matchAll(/<!--\/VISIBLE:[a-z0-9-]+-->/g)];
            assert.ok(ends.length, 'Missing collection insertion boundary');
            const last = ends.at(-1);
            const end = last.index + last[0].length;
            updated = updated.slice(0, end) + retained.join('') + updated.slice(end);
          }
        }
        replacements.delete(relative);
      }
      before.push(hash(bytes) + '  ' + relative);
      await write(relative, updated);
      htmlCount++;
    }
  }
  await walk(baselineRoot);
  assert.equal(replacements.size, 0, 'Every approved page must exist in the live snapshot');
  if (approvedArticleBytes) await write('content/articles.json', approvedArticleBytes);
  for (const asset of [...newRefs, ...(approvedRoutes.includes('/collection') ? ['/assets/workshop/blessing-2007.jpeg'] : [])]) {
    await write(asset.slice(1), await readFile(path.join(buildRoot, asset.slice(1))));
  }
  await writeFile(path.join(outputRoot, 'before.sha256'), before.sort().join('\n') + '\n');
  await writeFile(path.join(outputRoot, 'after.sha256'), after.sort().join('\n') + '\n');
  return { htmlCount, files: after.length, oldRefs, newRefs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [baselineRoot, buildRoot, outputRoot] = process.argv.slice(2);
  assert.ok(baselineRoot && buildRoot && outputRoot, 'Usage: node package-home-shop-release.mjs LIVE BUILD OUTPUT');
  console.log(await prepareHomeShopRelease({ baselineRoot, buildRoot, outputRoot }));
}
