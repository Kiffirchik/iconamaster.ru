// Build a narrow overlay from current LIVE HTML, never repository snapshots of edited pages.
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

export async function prepareVideoRelease({ baselineRoot, buildRoot, outputRoot }) {
  await mkdir(path.dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot); // EEXIST is intentional: never merge into a stale payload.
  const oldRefs = assetRefs(await read(path.join(baselineRoot, 'index.html')));
  const newRefs = assetRefs(await read(path.join(buildRoot, 'index.html')));
  const before = [], after = [];
  let htmlCount = 0;
  const write = async (relative, bytes) => {
    assert.ok(!relative.includes('..') && !path.isAbsolute(relative) && !relative.includes('\\'));
    const target = path.join(outputRoot, 'site', relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    after.push(hash(bytes) + '  ' + relative);
  };
  const routes = JSON.parse(await read(path.join(buildRoot, '.live-templates/routes.json')));
  const replacements = new Set([
    'video/index.html', 'articles/icon-painting-pigments/index.html',
    '.live-templates/' + routes['/articles/icon-painting-pigments'],
  ]);
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const relative = prefix + entry.name;
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
        replacements.delete(relative);
      }
      before.push(hash(bytes) + '  ' + relative);
      await write(relative, updated);
      htmlCount++;
    }
  }
  await walk(baselineRoot);
  assert.equal(replacements.size, 0, 'Every intended page must exist in the live snapshot');
  const videosBefore = await readFile(path.join(baselineRoot, 'content/videos.json'));
  const videosBytes = await readFile(path.join(buildRoot, 'content/videos.json'));
  const videos = JSON.parse(videosBytes);
  assert.deepEqual(videos.filter(v => v.provider !== 'local'), JSON.parse(videosBefore), 'Existing external videos changed');
  before.push(hash(videosBefore) + '  content/videos.json');
  await write('content/videos.json', videosBytes);
  const assets = [...newRefs, ...videos.filter(v => v.provider === 'local').flatMap(v => [v.src, v.image.src])];
  for (const asset of assets) {
    const relative = asset.slice(1);
    await write(relative, await readFile(path.join(buildRoot, relative)));
  }
  await writeFile(path.join(outputRoot, 'before.sha256'), before.sort().join('\n') + '\n');
  await writeFile(path.join(outputRoot, 'after.sha256'), after.sort().join('\n') + '\n');
  return { htmlCount, files: after.length, oldRefs, newRefs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await prepareVideoRelease({
    baselineRoot: '.release-artifacts/videos-html-baseline-20260917',
    buildRoot: 'dist/client', outputRoot: '.release-artifacts/videos-payload-20260917-v2',
  }));
}
