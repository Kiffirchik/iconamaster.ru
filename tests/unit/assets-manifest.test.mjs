import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';

const root = new URL('../../public/assets/icons/', import.meta.url);

test('every original icon matches its committed SHA-256', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  assert.ok(manifest.length >= 11);
  for (const asset of manifest) {
    assert.match(asset.sourceUrl, /^https:\/\/freight\.cargo\.site\/t\/original\//);
    assert.ok(asset.width > 0 && asset.height > 0, asset.file);
    const bytes = await readFile(new URL(asset.file, root));
    assert.equal(bytes.length, asset.bytes, asset.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.file);
  }
});
