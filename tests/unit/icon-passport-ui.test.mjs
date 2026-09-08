import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { icons as seedIcons } from '../../src/data/icons.js';
import { filterIcons } from '../../src/lib/catalog.js';

async function loadUI(context) {
  const server = await createServer({
    appType: 'custom', logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true },
  });
  context.after(() => server.close());
  const modules = await Promise.all([
    '/src/pages/HomePage.jsx', '/src/pages/IconDetailPage.jsx',
    '/src/pages/CollectionPage.jsx', '/src/components/IconCard.jsx',
    '/src/components/CatalogFilters.jsx',
  ].map((path) => server.ssrLoadModule(path)));
  return Object.assign({}, ...modules);
}

const icon = {
  slug: 'archangel-michael', title: 'Тестовая икона', published: true, order: 1,
  period: ' XIX век ', purpose: ' Храмовая ', size: ' 30 × 40 см ',
  technique: 'Яичная темпера', condition: 'Хорошая сохранность', expertise: 'Заключение эксперта 2024 года',
  origin: 'Отдельное происхождение', authorship: 'Отдельное авторство', author: 'Отдельный автор',
  type: 'Авторские', description: 'Авторская работа мастерской. Происходит из частного собрания.',
  price: 'По запросу', availability: 'В наличии',
  images: [{ src: '/assets/icons/archangel-michael.jpg', alt: 'Полный вид', width: 2342, height: 2685 }],
};

function render(Page, item) {
  return renderToStaticMarkup(createElement(Page, { icon: item, icons: [item], onNavigate() {} }));
}

test('home and detail passports show real period, purpose, size and meaningful supporting facts', async (context) => {
  const { HomePage, IconDetailPage } = await loadUI(context);
  for (const Page of [HomePage, IconDetailPage]) {
    const markup = render(Page, icon);
    for (const [label, value] of [
      ['Период', 'XIX век'], ['Назначение', 'Храмовая'], ['Размер', '30 × 40 см'],
      ['Техника', 'Яичная темпера'], ['Состояние', 'Хорошая сохранность'],
      ['Экспертное заключение', 'Заключение эксперта 2024 года'],
    ]) assert.ok(markup.includes(`<dt>${label}</dt><dd>${value}</dd>`), `${Page.name}: missing ${label}`);
    assert.doesNotMatch(markup, /Происхождение|Отдельное|Отдельный|Авторские|<dt>Авторство<\/dt>|<dt>Автор<\/dt>/);
  }
  const detail = render(IconDetailPage, icon);
  assert.ok(detail.includes(icon.description), 'authorship and provenance remain in the description');
  assert.match(detail, /<p class="eyebrow">Храмовая · XIX век<\/p>/);
});

test('blank and placeholder facts leave no empty passport, heading, eyebrow or card metadata', async (context) => {
  const { HomePage, IconDetailPage, IconCard } = await loadUI(context);
  for (const value of [undefined, null, '', ' \n ', 'Уточняется при консультации', ' УТОЧНЯЕТСЯ ПРИ КОНСУЛЬТАЦИИ. ', '—', '-', 'Не указано', 'Нет данных']) {
    const item = { ...icon, period: value, purpose: value, size: value, technique: value, condition: value, expertise: value, description: value };
    for (const Page of [HomePage, IconDetailPage, IconCard]) {
      const markup = render(Page, item);
      assert.doesNotMatch(markup, /object-passport|Паспорт предмета|Уточняется при консультации|УТОЧНЯЕТСЯ|Не указано|Нет данных|Отдельное|Авторские/);
      if (Page === IconDetailPage) assert.doesNotMatch(markup, /class="eyebrow"|icon-detail-page__description/);
      if (Page === IconCard) assert.doesNotMatch(markup, /icon-card__period|<p>\s*[-—]?\s*<\/p>/);
    }
  }
});

test('mixed passport fields omit only unavailable facts', async (context) => {
  const { HomePage, IconDetailPage } = await loadUI(context);
  const item = { ...icon, purpose: '', size: 'Уточняется при консультации', condition: '—', expertise: null };
  for (const Page of [HomePage, IconDetailPage]) {
    const markup = render(Page, item);
    assert.match(markup, /<dt>Период<\/dt><dd>XIX век<\/dd>/);
    assert.match(markup, /<dt>Техника<\/dt><dd>Яичная темпера<\/dd>/);
    assert.doesNotMatch(markup, /<dt>(Назначение|Размер|Состояние|Экспертное заключение)<\/dt>/);
  }
});

test('catalog exposes only period then purpose, combines choices and resets without hiding sold cards', async (context) => {
  const { CatalogFilters, CollectionPage } = await loadUI(context);
  const items = [icon, { ...icon, slug: 'home', purpose: 'Домашняя', period: 'XX век', availability: 'Продано' }];
  let filters = { period: 'all', purpose: 'all' };
  const form = () => CatalogFilters({
    items, filters,
    onChange: (change) => { filters = { ...filters, ...change }; },
    onReset: () => { filters = { period: 'all', purpose: 'all' }; },
  });
  const markup = renderToStaticMarkup(createElement(CollectionPage, { icons: items }));
  assert.match(markup, /<label for="catalog-filter-purpose">Назначение<\/label>/);
  assert.match(markup, /<option value="Храмовая">Храмовая<\/option>/);
  assert.deepEqual([...markup.matchAll(/<select[^>]* name="([^"]+)"/g)].map((match) => match[1]), ['period', 'purpose']);
  assert.doesNotMatch(markup, /Тип иконы|Авторские|catalog-filter-type|catalog-filter-availability/);
  assert.match(markup, /Продано/);
  assert.equal((markup.match(/class="icon-card"/g) ?? []).length, 2);

  const purposeSelect = form().props.children[0]
    .flatMap((field) => field.props.children)
    .find((child) => child.type === 'select' && child.props.name === 'purpose');
  assert.ok(purposeSelect, 'purpose select exists');
  purposeSelect.props.onChange({ target: { value: 'Домашняя' } });
  assert.deepEqual(filters, { period: 'all', purpose: 'Домашняя' });
  assert.deepEqual(filterIcons(items, filters).map(({ slug }) => slug), ['home']);
  const selectedMarkup = renderToStaticMarkup(form());
  assert.match(selectedMarkup, /<option value="Домашняя" selected="">Домашняя<\/option>/);
  const periodSelect = form().props.children[0]
    .flatMap((field) => field.props.children)
    .find((child) => child.type === 'select' && child.props.name === 'period');
  periodSelect.props.onChange({ target: { value: 'XIX век' } });
  assert.equal(filterIcons(items, filters).length, 0, 'both selected filters apply');
  periodSelect.props.onChange({ target: { value: 'XX век' } });
  assert.deepEqual(filterIcons(items, filters).map(({ slug }) => slug), ['home']);
  form().props.children[1].props.onClick();
  assert.deepEqual(filters, { period: 'all', purpose: 'all' });
  assert.equal(filterIcons(items, filters).length, 2);
  assert.doesNotMatch(renderToStaticMarkup(form()), /catalog-filters__reset/);
});

test('published fallback seed records render without purpose or consultation placeholders', async (context) => {
  const { CollectionPage, HomePage, IconDetailPage } = await loadUI(context);
  const items = seedIcons.map((item, order) => ({ ...item, published: true, order }));
  const collection = renderToStaticMarkup(createElement(CollectionPage, { icons: items }));
  assert.equal((collection.match(/class="icon-card"/g) ?? []).length, 6);
  assert.doesNotMatch(collection, /Уточняется при консультации|Авторские/);
  for (const item of items) {
    assert.doesNotMatch(render(IconDetailPage, item), /Уточняется при консультации|Происхождение|Авторские|<dt>Назначение<\/dt>/);
  }
  assert.doesNotMatch(render(HomePage, items[0]), /Уточняется при консультации|Происхождение|<dt>Назначение<\/dt>/);
});
