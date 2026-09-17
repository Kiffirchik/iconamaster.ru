// Replace only the stylesheet reference in a fresh live HTML snapshot.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const cssRef = html => {
  const match = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.css/);
  assert.ok(match, 'Missing built stylesheet');
  return match[0];
};

export async function prepareCssRelease({ baselineRoot, buildRoot, outputRoot }) {
  await mkdir(path.dirname(outputRoot), { recursive: true });
  await mkdir(outputRoot); // Never reuse a stale overlay.
  const oldRef = cssRef(await readFile(path.join(baselineRoot, 'index.html'), 'utf8'));
  const newRef = cssRef(await readFile(path.join(buildRoot, 'index.html'), 'utf8'));
  assert.notEqual(oldRef, newRef, 'Stylesheet must have a new cache key');
  const before = [], after = [];
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
      if (entry.isDirectory()) { await walk(path.join(dir, entry.name), relative + '/'); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
      const bytes = await readFile(path.join(dir, entry.name));
      const html = bytes.toString('utf8');
      if (!html.includes(oldRef)) continue;
      before.push(hash(bytes) + '  ' + relative);
      await write(relative, html.replaceAll(oldRef, newRef));
    }
  }
  await walk(baselineRoot);
  assert.ok(before.length > 0, 'No live HTML found');
  await write(newRef.slice(1), await readFile(path.join(buildRoot, newRef.slice(1))));
  await writeFile(path.join(outputRoot, 'before.sha256'), before.sort().join('\n') + '\n');
  await writeFile(path.join(outputRoot, 'after.sha256'), after.sort().join('\n') + '\n');
  return { htmlCount: before.length, files: after.length, oldRef, newRef };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [baselineRoot, buildRoot, outputRoot] = process.argv.slice(2);
  assert.ok(baselineRoot && buildRoot && outputRoot, 'Usage: node package-css-release.mjs LIVE_HTML BUILD OUTPUT');
  console.log(await prepareCssRelease({ baselineRoot, buildRoot, outputRoot }));
}
