import assert from 'node:assert/strict';
import test from 'node:test';
import { homeContent } from '../../src/data/home-content.js';

test('defines approved homepage content and anchors', () => {
  assert.equal(homeContent.established, '1991');
  assert.match(homeContent.materials, /минеральн/i);
  assert.match(homeContent.materials, /сусальн/i);
  assert.equal(homeContent.saleSlugs.length, 8);
  assert.equal(new Set(homeContent.saleSlugs).size, 8);
  assert.ok(homeContent.saleSlugs.includes('venchalnaya-para-vsederzhitel-kazanskaya'));
  assert.match(homeContent.atelier.text, /Игорь Дрождин/u);
  assert.match(homeContent.atelier.history, /1998/u);
  assert.match(homeContent.blessing.text, /14 мая 2007/u);
  assert.deepEqual(homeContent.featuredArticleSlugs, [
    'restoration-murals-cleaning',
    'georgievsky-church-iconostasis',
  ]);
  assert.deepEqual(homeContent.sectionIds, ['atelier', 'restoration', 'research']);
});
