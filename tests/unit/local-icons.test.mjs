import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { localIconSources } from '../../scripts/local-icon-sources.mjs';
import { getDiscount } from '../../src/lib/pricing.js';

test('three supplied icons preserve text, independent prices and every original photo', async () => {
  const icons = JSON.parse(await readFile(new URL('../../public/content/icons.json', import.meta.url)));
  assert.equal(localIconSources.length, 3);
  assert.deepEqual(localIconSources.map(x => x.originals.length), [6, 5, 3]);
  const hashes = new Set();
  for (const source of localIconSources) {
    const icon = icons.find(x => x.slug === source.slug);
    assert.ok(icon?.published);
    assert.equal(icon.title, source.title);
    assert.equal(icon.description, source.texts.description.value);
    assert.equal(icon.moreDetails, source.texts.moreDetails.value);
    assert.equal(icon.size, '21 × 17 см; киот 35 × 30 см');
    assert.equal(icon.price, '60 000 руб.');
    assert.equal(icon.discount, 50);
    assert.equal(icon.newPrice, 29000);
    assert.ok(getDiscount(icon));
    assert.equal(icon.images.length, source.originals.length);
    for (const original of source.originals) {
      const bytes = await readFile(new URL(`../../public/assets/icons/${original.file}`, import.meta.url));
      const hash = createHash('sha256').update(bytes).digest('hex');
      assert.equal(hash, original.sha256);
      assert(!hashes.has(hash), 'No duplicate photographs in imported batch');
      hashes.add(hash);
      assert(icon.images.some(x => x.src.endsWith('/' + original.file) && x.fit === 'contain'));
    }
  }
});
