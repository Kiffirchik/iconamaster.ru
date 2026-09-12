import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { getDiscount, formatPrice, parsePrice } from '../../src/lib/pricing.js';
import { filterIcons } from '../../src/lib/catalog.js';

const icon = { slug: 'test', title: 'Икона', price: '100 000 руб.', discount: 10, newPrice: 90000,
  availability: 'В наличии', period: 'XIX век', purpose: 'Храмовая', published: true,
  images: [{ src: '/test.jpg', alt: 'Икона', width: 100, height: 120 }] };

test('discounts require an active percentage and a genuine lower price', () => {
  assert.deepEqual(getDiscount(icon), { percent: 10, price: 100000, newPrice: 90000 });
  for (const discount of [null, undefined, 0, '0', 'null', '', -1, 100, NaN, Infinity, true]) {
    assert.equal(getDiscount({ ...icon, discount }), null);
  }
  for (const newPrice of [null, undefined, 0, -1, 100000, 120000, NaN, Infinity, '90000']) {
    assert.equal(getDiscount({ ...icon, newPrice }), null);
  }
  assert.equal(getDiscount({ ...icon, price: 'Цена по запросу' }), null);
  assert.equal(parsePrice('100\u00a0000,50 ₽'), 100000.5);
  assert.equal(parsePrice('Размер 31 руб.'), null);
  assert.equal(formatPrice(90000), '90 000 руб.');
  assert.equal(formatPrice(90000.5), '90 000,50 руб.');
});

test('discount filter combines with period and purpose and includes only visible valid offers', () => {
  const plain = { ...icon, slug: 'plain', discount: null };
  const other = { ...icon, slug: 'other', period: 'XX век' };
  const invalid = { ...icon, slug: 'invalid', newPrice: null };
  const items = [icon, plain, other, invalid];
  assert.deepEqual(filterIcons(items, { discountsOnly: true }).map(x => x.slug), ['test', 'other']);
  assert.deepEqual(filterIcons(items, { discountsOnly: true, period: 'XIX век', purpose: 'Храмовая' }), [icon]);
  assert.equal(filterIcons(items, { discountsOnly: false }).length, 4);
});

test('card and detail show discounted price and accessible toggle; SEO uses new amount', async context => {
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  context.after(() => server.close());
  const { IconPrice } = await server.ssrLoadModule('/src/components/IconPrice.jsx');
  const { IconCard } = await server.ssrLoadModule('/src/components/IconCard.jsx');
  const { IconDetailPage } = await server.ssrLoadModule('/src/pages/IconDetailPage.jsx');
  const { CatalogFilters } = await server.ssrLoadModule('/src/components/CatalogFilters.jsx');
  for (const Component of [IconPrice, IconCard, IconDetailPage]) {
    const markup = renderToStaticMarkup(h(Component, { icon, icons: [icon], className: 'price' }));
    assert.match(markup, /<del[^>]*>100 000 руб\.<\/del>/u);
    assert.match(markup, /aria-label="Скидка 10%">%<\/span>/u);
    assert.match(markup, /aria-label="Новая цена">90 000 руб\.<\/strong>/u);
    for (const discount of [0, null]) {
      const ordinary = renderToStaticMarkup(h(Component, { icon: { ...icon, discount }, icons: [icon] }));
      assert.doesNotMatch(ordinary, /<del|icon-price__new|icon-price__discount/u);
    }
  }
  let filters = { period: 'all', purpose: 'all', discountsOnly: false };
  const form = () => CatalogFilters({ items: [icon], filters, onChange: change => { filters = { ...filters, ...change }; }, onReset: () => { filters = { period: 'all', purpose: 'all', discountsOnly: false }; } });
  const toggle = form().props.children.find(child => child?.props?.className === 'catalog-filters__discounts');
  toggle.props.onClick();
  assert.equal(filters.discountsOnly, true);
  assert.match(renderToStaticMarkup(form()), /aria-pressed="true"/u);
  form().props.children.find(child => child?.props?.className === 'catalog-filters__reset').props.onClick();
  assert.equal(filters.discountsOnly, false);
  const { buildSeoDescriptor } = await server.ssrLoadModule('/src/lib/seo.js');
  const seo = buildSeoDescriptor('/icons/test', { icons: [icon] });
  assert.equal(seo.structuredData['@graph'].find(x => x['@type'] === 'Product').offers.price, 90000);
});
