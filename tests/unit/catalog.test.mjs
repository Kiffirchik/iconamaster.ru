import assert from 'node:assert/strict';
import test from 'node:test';
import { icons } from '../../src/data/icons.js';
import { filterIcons, findIconBySlug, getFilterOptions, getNextIcon } from '../../src/lib/catalog.js';

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

test('getFilterOptions excludes blank filter values', () => {
  const options = getFilterOptions([
    { type: 'Авторские' },
    { type: '' },
    { type: '   ' },
    { type: null },
    {}
  ], 'type');

  assert.deepEqual(options, ['all', 'Авторские']);
});

test('getNextIcon wraps from the final catalog record to the first', () => {
  assert.equal(getNextIcon(icons, icons.at(-1).slug).slug, icons[0].slug);
});

test('findIconBySlug returns the matching icon passport or null', () => {
  assert.equal(findIconBySlug(icons, 'alexander-peresvet').price, '100 000 руб.');
  assert.equal(findIconBySlug(icons, 'missing'), null);
});

test('catalog keeps complete original-image sets for detail galleries', () => {
  assert.ok(findIconBySlug(icons, 'facade-george').images.length >= 5);
  assert.equal(findIconBySlug(icons, 'sergius-appearance').images.length, 2);
});

test('purpose filtering combines period and availability without falling back to type', () => {
  const items = [
    { slug: 'match', purpose: '  Храмовая  ', type: 'Авторские', period: ' XIX век ', availability: 'В наличии' },
    { slug: 'other-purpose', purpose: 'Домашняя', type: 'Храмовая', period: 'XIX век', availability: 'В наличии' },
    { slug: 'legacy', type: 'Храмовая', period: 'XIX век', availability: 'В наличии' },
    { slug: 'other-period', purpose: 'Храмовая', period: 'Современная', availability: 'В наличии' },
    { slug: 'other-availability', purpose: 'Храмовая', period: 'XIX век', availability: 'По запросу' },
  ];
  const original = structuredClone(items);
  assert.deepEqual(filterIcons(items, {
    purpose: 'Храмовая', period: 'XIX век', availability: 'В наличии',
  }).map(({ slug }) => slug), ['match']);
  assert.deepEqual(items, original);
  assert.deepEqual(filterIcons(items, {
    purpose: 'all', period: 'all', availability: 'all',
  }), items);
});

test('purpose options are trimmed, unique, and exclude placeholders and legacy type', () => {
  const items = [
    { purpose: ' Храмовая ' }, { purpose: 'Храмовая' }, { purpose: 'Домашняя' },
    { purpose: 'Уточняется при консультации' }, { purpose: '  УТОЧНЯЕТСЯ ПРИ КОНСУЛЬТАЦИИ.  ' },
    { purpose: '—' }, { purpose: 'Не указано' }, { purpose: 'Нет данных' },
    { purpose: ' ' }, { purpose: null }, { purpose: 123 }, { type: 'Авторские' },
  ];
  assert.deepEqual(getFilterOptions(items, 'purpose'), ['all', 'Храмовая', 'Домашняя']);
  assert.deepEqual(filterIcons(items, { purpose: 'Храмовая' }), [items[0], items[1]]);
  assert.deepEqual(filterIcons(items, { purpose: 'Уточняется при консультации' }), []);
});

test('purpose reset preserves seed icons with no purpose without fabricating options', () => {
  assert.deepEqual(filterIcons(icons, { purpose: 'all', period: 'all', availability: 'all' }), icons);
  assert.deepEqual(getFilterOptions(icons, 'purpose'), ['all']);
  assert.deepEqual(filterIcons(icons, { purpose: 'Храмовая', period: 'all', availability: 'all' }), []);
});
