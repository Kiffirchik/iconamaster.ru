import assert from 'node:assert/strict';
import test from 'node:test';
import { icons } from '../../src/data/icons.js';
import { filterIcons, getFilterOptions, getNextIcon } from '../../src/lib/catalog.js';

test('filterIcons returns the verified temple icon for a type filter', () => {
  const result = filterIcons(icons, {
    type: 'Храмовые',
    period: 'all',
    availability: 'all'
  });

  assert.deepEqual(result.map(({ slug }) => slug), ['resurrection']);
});

test('filterIcons combines type, period, and availability without mutating the catalog', () => {
  const original = structuredClone(icons);

  const result = filterIcons(icons, {
    type: 'Авторские',
    period: 'Современные',
    availability: 'В наличии'
  });

  assert.deepEqual(result.map(({ slug }) => slug), ['archangel-michael', 'alexander-peresvet']);
  assert.deepEqual(icons, original);
});

test('filterIcons returns the full catalog after filters are reset to all', () => {
  const result = filterIcons(icons, {
    type: 'all',
    period: 'all',
    availability: 'all'
  });

  assert.deepEqual(result, icons);
});

test('filterIcons returns an empty collection when no icon matches combined filters', () => {
  const result = filterIcons(icons, {
    type: 'Фасадные',
    period: 'XVIII–XIX век',
    availability: 'В наличии'
  });

  assert.deepEqual(result, []);
});

test('getFilterOptions prepends all and removes duplicate period values', () => {
  const options = getFilterOptions(icons, 'period');

  assert.equal(options[0], 'all');
  assert.equal(new Set(options).size, options.length);
});

test('getNextIcon wraps from the final catalog record to the first', () => {
  assert.equal(getNextIcon(icons, icons.at(-1).slug).slug, icons[0].slug);
});
