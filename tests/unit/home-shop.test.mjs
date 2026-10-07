import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import * as catalog from '../../src/lib/catalog.js';

const items = [
  { slug: 'sergius-appearance', period: 'XIX век', availability: 'В наличии' },
  { slug: 'sergius-of-radonezh', period: 'XX век', availability: 'В наличии' },
  { slug: 'peter-and-fevronia-of-murom', period: '', availability: 'В наличии' },
  { slug: 'temple-icon-peter-and-paul', period: 'XVIII век', availability: 'В наличии' },
  { slug: 'ikona-spas-blagoe-molcanie-ili-angel-velikogo-soveta' },
  { slug: 'angel-khranitel-kiot' },
];

test('subject filtering includes a multi-figure icon under both named subjects', () => {
  assert.deepEqual(catalog.filterIcons(items, { subject: 'Богородица' }).map(i => i.slug), ['sergius-appearance']);
  assert.deepEqual(catalog.filterIcons(items, { subject: 'Сергий Радонежский' }).map(i => i.slug), ['sergius-appearance', 'sergius-of-radonezh']);
  assert.deepEqual(catalog.filterIcons(items, { subject: 'Феврония Муромская' }).map(i => i.slug), ['peter-and-fevronia-of-murom']);
  assert.deepEqual(catalog.filterIcons(items, { subject: 'Апостол Пётр' }).map(i => i.slug), ['temple-icon-peter-and-paul']);
});

test('subject options include only represented subjects and do not confuse different Angels', () => {
  assert.deepEqual(catalog.getFilterOptions([items[4], items[5]], 'subject'), ['all', 'Спаситель', 'Ангел Хранитель']);
  assert.deepEqual(catalog.filterIcons(items, { subject: 'Ангел Хранитель' }).map(i => i.slug), ['angel-khranitel-kiot']);
  assert.deepEqual(catalog.getFilterOptions([], 'subject'), ['all']);
});

test('catalog subject mapping covers folding kiot and wedding pair, not just homepage selection', () => {
  const works = [{ slug: 'folding-kiot' }, { slug: 'wedding-icons' }];
  assert.deepEqual(catalog.filterIcons(works, { subject: 'Богородица' }), works);
  assert.deepEqual(catalog.filterIcons(works, { subject: 'Спаситель' }), works);
  assert.deepEqual(catalog.filterIcons(works, { subject: 'Праздничные иконы' }), [works[0]]);
});

test('subject filter combines with existing filters, returns empty results, and resets without mutation', () => {
  const before = structuredClone(items);
  assert.deepEqual(catalog.filterIcons(items, { subject: 'Сергий Радонежский', period: 'XIX век' }).map(i => i.slug), ['sergius-appearance']);
  assert.deepEqual(catalog.filterIcons(items, { subject: 'Сергий Радонежский', period: 'XV век' }), []);
  assert.deepEqual(catalog.filterIcons(items, { subject: 'all', period: 'all' }), items);
  assert.deepEqual(items, before);
});

test('homepage catalog keeps preferred order then every published work, including unpriced and sold records', () => {
  assert.equal(typeof catalog.getHomeCatalogIcons, 'function');
  const sale = { published: true, availability: 'В наличии', price: '29 000 руб.', images: [{ src: '/original.jpg' }] };
  const stock = [
    { ...sale, slug: 'ready' },
    { ...sale, slug: 'sold', availability: 'Продано' },
    { ...sale, slug: 'order', availability: 'Под заказ' },
    { ...sale, slug: 'hidden', published: false },
    { ...sale, slug: 'no-image', images: [] },
    { ...sale, slug: 'no-price', price: null },
    { ...sale, slug: 'not-selected' },
  ];
  const ordered = catalog.getHomeCatalogIcons(stock, ['ready', 'ready', 'hidden', 'missing']);
  assert.deepEqual(ordered.map(i => i.slug), ['ready', 'sold', 'order', 'no-price', 'not-selected']);
  assert.deepEqual(catalog.filterIcons(ordered, { availability: 'В наличии' }).map(i => i.slug), ['ready', 'no-price', 'not-selected']);
  assert.deepEqual(catalog.filterIcons(ordered, { availability: 'all' }).map(i => i.slug), ['ready', 'sold', 'order', 'no-price', 'not-selected']);
});

test('homepage defaults to every in-stock work, keeps the curated lead and lazily loads the rest', async context => {
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  context.after(() => server.close());
  const { HomePage } = await server.ssrLoadModule('/src/pages/HomePage.jsx');
  const { CollectionPage } = await server.ssrLoadModule('/src/pages/CollectionPage.jsx');
  const icons = JSON.parse(await readFile('public/content/icons.json', 'utf8'));
  const html = renderToStaticMarkup(h(HomePage, { icons, articles: [{ slug: 'restoration-murals-cleaning', title: 'Workshop story', published: true }] }));
  assert.match(html, /href="\/icons\/angel-khranitel-kiot"/u);
  assert.ok(html.indexOf('href="/icons/angel-khranitel-kiot"') < html.indexOf('Workshop story'));
  const slugs = [...html.matchAll(/<article class="icon-card" data-live-visible="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(slugs.length, 90);
  assert.deepEqual(slugs.slice(0, 8), [
    'angel-khranitel-kiot', 'gospod-vsederzhitel-kiot', 'theotokos-kazanskaya', 'panteleimon-tselitel-kiot',
    'peter-and-fevronia-of-murom', 'ikona-bogorodity-utoli-moi-pecali',
    'venchalnaya-para-vsederzhitel-kazanskaya', 'saint-nicholas-wonderworker',
  ]);
  assert.equal(new Set(slugs).size, 90);
  assert.match(html, /Найдено: 90/u);
  assert.match(html, /<option value="В наличии" selected="">/u);
  assert.match(html, /<option value="all">Все работы<\/option>/u);
  assert.ok(!html.includes('>Сбросить<'), 'default availability is not an active custom filter');
  const cardMarkup = html.slice(html.indexOf('id="home-sale-gallery"'), html.indexOf('class="home-sale__controls"'));
  assert.equal((cardMarkup.match(/loading="eager"/g) ?? []).length, 4);
  assert.equal((cardMarkup.match(/loading="lazy"/g) ?? []).length, 86);
  assert.match(html, /aria-label="Следующая икона"/u);
  assert.match(html, /aria-label="Предыдущая икона"[^>]*disabled/u);
  assert.match(html, /aria-label="Положение в подборке"[^>]*>1 из 90</u);
  assert.match(html, /<option value="Феврония Муромская">/u);
  assert.match(html, /href="\/icons\/peter-and-fevronia-of-murom"/u);
  for (const icon of icons.filter(i => !i.published || i.availability !== 'В наличии')) {
    assert.ok(!slugs.includes(icon.slug), `${icon.slug} is excluded by the default filter`);
  }
  assert.match(html, /Образ \/ святой/u);
  assert.match(html, /href="\/assets\/workshop\/blessing-2007.jpeg"/u);
  const collectionHtml = renderToStaticMarkup(h(CollectionPage, { icons }));
  assert.match(collectionHtml, /Образ \/ святой/u);
  assert.equal((collectionHtml.match(/<article class="icon-card/g) ?? []).length, 97);
});

test('mobile gallery follows scroll position, clamps navigation and supports keyboard without stealing link keys', async context => {
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  context.after(() => server.close());
  const { HomeIconGallery } = await server.ssrLoadModule('/src/pages/HomePage.jsx');
  assert.equal(typeof HomeIconGallery, 'function');
  const icons = Array.from({ length: 4 }, (_, index) => ({ slug: `icon-${index}`, title: `Icon ${index}`, images: [{ src: '/original.jpg' }] }));
  const gallery = new HomeIconGallery({ icons }, undefined, {
    enqueueSetState(instance, update) { instance.state = { ...instance.state, ...update }; },
  });
  // DOM geometry is the external boundary: 300px cards with a 20px gap and a 350px viewport.
  const track = {
    scrollLeft: 0,
    clientWidth: 350,
    scrollWidth: 1260,
    getBoundingClientRect: () => ({ left: 16 }),
    scrollTo({ left }) { this.scrollLeft = Math.max(0, Math.min(left, 910)); },
    children: [],
  };
  track.children = icons.map((_, index) => ({ getBoundingClientRect: () => ({ left: 16 + index * 320 - track.scrollLeft, width: 300, right: 316 + index * 320 - track.scrollLeft }) }));
  gallery.trackRef.current = track;
  gallery.goTo(1);
  assert.equal(track.scrollLeft, 320);
  gallery.syncActiveCard();
  assert.equal(gallery.state.activeIndex, 1);
  track.scrollLeft = 910;
  gallery.syncActiveCard();
  assert.equal(gallery.state.activeIndex, 3, 'last card is active even though it cannot align with the leading edge');
  assert.match(renderToStaticMarkup(gallery.render()), /aria-label="Следующая икона"[^>]*disabled/u);
  gallery.goTo(99);
  assert.equal(track.scrollLeft, 910);
  gallery.goTo(-1);
  assert.equal(track.scrollLeft, 0);
  let prevented = false;
  gallery.handleKeyDown({ target: track, currentTarget: track, key: 'End', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(track.scrollLeft, 910);
  gallery.syncActiveCard();
  gallery.handleKeyDown({ target: track, currentTarget: track, key: 'ArrowLeft', preventDefault() {} });
  assert.equal(track.scrollLeft, 640);
  gallery.handleKeyDown({ target: {}, currentTarget: track, key: 'Home', preventDefault() { assert.fail('link key must not be intercepted'); } });
  assert.equal(track.scrollLeft, 640);
  gallery.handleKeyDown({ target: track, currentTarget: track, key: 'Home', preventDefault() {} });
  assert.equal(track.scrollLeft, 0);
  const single = new HomeIconGallery({ icons: icons.slice(0, 1) });
  assert.doesNotMatch(renderToStaticMarkup(single.render()), /aria-label="Следующая икона"/u);
  const empty = new HomeIconGallery({ icons: [] });
  assert.equal(renderToStaticMarkup(empty.render()), '');
});

test('desktop gallery advances by the visible group and disables next at the last group, not only the last index', async context => {
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  context.after(() => server.close());
  const { HomeIconGallery } = await server.ssrLoadModule('/src/pages/HomePage.jsx');
  const icons = Array.from({ length: 8 }, (_, index) => ({ slug: `icon-${index}`, title: `Icon ${index}`, images: [{ src: '/original.jpg' }] }));
  const gallery = new HomeIconGallery({ icons }, undefined, {
    enqueueSetState(instance, update) { instance.state = { ...instance.state, ...update }; },
  });
  const track = {
    scrollLeft: 0, clientWidth: 1320, scrollWidth: 2540,
    getBoundingClientRect: () => ({ left: 16 }),
    scrollTo({ left }) { this.scrollLeft = Math.max(0, Math.min(left, 1220)); },
    children: [],
  };
  track.children = icons.map((_, index) => ({ getBoundingClientRect: () => ({ left: 16 + index * 320 - track.scrollLeft, width: 300, right: 316 + index * 320 - track.scrollLeft }) }));
  gallery.trackRef.current = track;
  gallery.syncActiveCard();
  assert.match(renderToStaticMarkup(gallery.render()), />1–4 из 8</u);
  assert.equal(typeof gallery.movePage, 'function');
  gallery.movePage(1);
  assert.equal(track.scrollLeft, 1220);
  gallery.syncActiveCard();
  const endMarkup = renderToStaticMarkup(gallery.render());
  assert.match(endMarkup, />5–8 из 8</u);
  assert.match(endMarkup, /aria-label="Следующая икона"[^>]*disabled/u);
  gallery.movePage(-1);
  assert.equal(track.scrollLeft, 0);
  track.clientWidth = 3000;
  gallery.syncActiveCard();
  assert.match(renderToStaticMarkup(gallery.render()), />1–8 из 8</u);
  assert.match(renderToStaticMarkup(gallery.render()), /aria-label="Следующая икона"[^>]*disabled/u);
});
