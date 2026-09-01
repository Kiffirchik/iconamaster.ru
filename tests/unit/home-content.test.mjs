import assert from 'node:assert/strict';
import test from 'node:test';
import { homeContent } from '../../src/data/home-content.js';

test('defines approved homepage content and anchors', () => {
  assert.equal(homeContent.established, '1991');
  assert.match(homeContent.materials, /минеральн/i);
  assert.match(homeContent.materials, /сусальн/i);
  assert.deepEqual(homeContent.featuredSlugs, ['archangel-michael', 'sergius-appearance', 'facade-george']);
  assert.deepEqual(homeContent.featuredArticleSlugs, [
    'restoration-murals-cleaning',
    'georgievsky-church-iconostasis',
  ]);
  assert.deepEqual(homeContent.sectionIds, ['atelier', 'restoration', 'research']);
});
