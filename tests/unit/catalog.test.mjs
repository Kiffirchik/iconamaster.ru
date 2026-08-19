import assert from 'node:assert/strict';
import test from 'node:test';
import { icons } from '../../src/data/icons.js';
import { filterIcons, getNextIcon } from '../../src/lib/catalog.js';

test('filterIcons returns the verified temple icon for a type filter', () => {
  const result = filterIcons(icons, {
    type: 'Храмовые',
    period: 'all',
    availability: 'all'
  });

  assert.deepEqual(result.map(({ slug }) => slug), ['resurrection']);
});

test('getNextIcon wraps from the final catalog record to the first', () => {
  assert.equal(getNextIcon(icons, icons.at(-1).slug).slug, icons[0].slug);
});
