import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { localIconSources } from '../../scripts/local-icon-sources.mjs';
import { getDiscount } from '../../src/lib/pricing.js';

test('three supplied icons preserve text, independent prices and every original photo', async () => {
  const icons = JSON.parse(await readFile(new URL('../../public/content/icons.json', import.meta.url)));
  const firstBatch = localIconSources.filter(x => x.slug !== 'venchalnaya-para-vsederzhitel-kazanskaya');
  assert.equal(firstBatch.length, 3);
  assert.deepEqual(firstBatch.map(x => x.originals.length), [6, 5, 3]);
  const hashes = new Set();
  for (const source of firstBatch) {
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

test('wedding pair retains owner texts, purpose, independent sale price and both original photographs', async () => {
  const icons=JSON.parse(await readFile(new URL('../../public/content/icons.json',import.meta.url)));
  const matches=icons.filter(x=>x.slug==='venchalnaya-para-vsederzhitel-kazanskaya');
  assert.equal(matches.length,1);
  const icon=matches[0];const source=localIconSources.find(x=>x.slug===icon.slug);
  assert.equal(icon.title,'Господь Вседержитель и Богородица Казанская');
  assert.equal(icon.description,source.texts.description.value);
  assert.equal(icon.moreDetails,source.texts.moreDetails.value);
  assert.equal(icon.size,'21 × 17 см; киот 35 × 30 см');
  assert.equal(icon.price,'120 000 руб.');assert.equal(icon.discount,50);assert.equal(icon.newPrice,58000);
  assert.equal(icon.purpose,'Венчальная');assert.equal(icon.published,true);assert.ok(getDiscount(icon));
  assert.equal(icon.images.length,2);
  assert.equal(source.originals[0].sourceFile,'photo_5269738934927826055_y.jpg');
  for(const original of source.originals){
    const bytes=await readFile(new URL('../../public/assets/icons/'+original.file,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),original.sha256);
    assert(icon.images.some(x=>x.src.endsWith('/'+original.file)&&x.fit==='contain'));
  }
});
