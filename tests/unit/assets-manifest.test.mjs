import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { localIconSources } from '../../scripts/local-icon-sources.mjs';

const root = new URL('../../public/assets/icons/', import.meta.url);

test('every original icon matches its committed SHA-256', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  assert.ok(manifest.length >= 11);
  const archangel = manifest.find((asset) => asset.id === 'archangel-michael-main');
  assert.equal(
    archangel?.sourceUrl,
    'https://freight.cargo.site/t/original/i/e8b1c0a63f13a6d9ce58148213497635407338802c06e246f5a61c35dea111b9/_DSC9152.JPG'
  );
  for (const asset of manifest) {
    const local = localIconSources.flatMap(x => x.originals).find(x => x.sourceUrl === asset.sourceUrl);
    if (local) {
      assert.equal(asset.provenance, 'owner-supplied-original-20260912');
      assert.equal(asset.sha256, local.sha256);
      assert.equal(asset.file, local.file);
    } else assert.match(asset.sourceUrl, /^https:\/\/freight\.cargo\.site\/t\/original\//);
    assert.ok(asset.width > 0 && asset.height > 0, asset.file);
    const bytes = await readFile(new URL(asset.file, root));
    assert.equal(bytes.length, asset.bytes, asset.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.file);
  }
});
