import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Component, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { icons } from '../../src/data/icons.js';
import { buildContactLinks } from '../../src/lib/contacts.js';
import { renderableSections } from '../../src/lib/content-selectors.js';

const root = new URL('../../src/', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

async function loadModules(context, paths) {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true }
  });
  context.after(() => server.close());
  const modules = await Promise.all(paths.map((path) => server.ssrLoadModule(path)));
  return Object.assign({}, ...modules);
}

function instantiateClassComponent(ComponentType, props) {
  const updater = {
    enqueueSetState(instance, update) {
      const nextState = typeof update === 'function' ? update(instance.state, instance.props) : update;
      instance.state = { ...instance.state, ...nextState };
    }
  };
  return new ComponentType(props, undefined, updater);
}

const image = {
  src: '/assets/icons/example.jpg',
  alt: 'Икона, полный вид',
  width: 1200,
  height: 1600,
  fit: 'contain',
  position: '50% 50%'
};

const icon = {
  slug: 'example',
  title: 'Икона Спас Вседержитель',
  published: true,
  images: [image],
  type: 'Старинная икона',
  period: 'XIX век',
  origin: 'Москва',
  technique: 'Темпера',
  size: '31 × 26 см',
  condition: 'Стабильное',
  expertise: '',
  description: 'Описание',
  price: null,
  availability: 'В наличии'
};

test('uses image metadata for every visible image frame and reserves the hero ratio', async () => {
  const [image, gallery, home, styles] = await Promise.all([
    source('components/IconImage.jsx'),
    source('components/IconGallery.jsx'),
    source('pages/HomePage.jsx'),
    source('styles.css')
  ]);

  assert.match(image, /aspectRatio:\s*`\$\{image\.width\}\s*\/\s*\$\{image\.height\}`/);
  assert.match(gallery, /style=\{\{\s*aspectRatio:\s*`\$\{image\.width\}\s*\/\s*\$\{image\.height\}`\s*\}\}/);
  assert.match(home, /style=\{\{\s*aspectRatio:\s*`\$\{heroIcon\.images\[0\]\.width\}\s*\/\s*\$\{heroIcon\.images\[0\]\.height\}`\s*\}\}/);
  assert.doesNotMatch(styles, /aspect-ratio:\s*3\s*\/\s*4/);
});

test('keeps only the hero eager and avoids fixed page overlays', async () => {
  const [image, home, styles] = await Promise.all([
    source('components/IconImage.jsx'),
    source('pages/HomePage.jsx'),
    source('styles.css')
  ]);

  assert.match(image, /loading=\{eager \? 'eager' : 'lazy'\}/);
  assert.match(image, /fetchPriority=\{eager \? 'high' : 'auto'\}/);
  assert.match(home, /<IconImage[^>]*mode="full" eager(?:\s*\/>|>)/);
  assert.doesNotMatch(styles, /position:\s*fixed/);
});

test('keeps the compact footer WhatsApp CTA at the shared 44px touch-target minimum', async () => {
  const styles = await source('styles.css');

  assert.match(
    styles,
    /\.consultation-links--compact \.button\s*\{[^}]*min-height:\s*2\.75rem;/s
  );
});

test('gives mobile secondary contact and navigation links 44px touch targets', async () => {
  const styles = await source('styles.css');
  const mobileStyles = styles.slice(
    styles.indexOf('@media (max-width: 760px)'),
    styles.indexOf('@media (max-width: 759px)')
  );

  assert.match(
    mobileStyles,
    /\.consultation-links__secondary,\s*\.icon-detail-page__navigation a,\s*\.icon-detail-page__contact-alternatives a,\s*\.site-footer__nav a\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*min-height:\s*2\.75rem;/s
  );
});

test('gives the remaining reviewed mobile links 44px touch targets', async () => {
  const styles = await source('styles.css');
  const mobileStyles = styles.slice(
    styles.indexOf('@media (max-width: 760px)'),
    styles.indexOf('@media (max-width: 759px)')
  );

  assert.match(
    mobileStyles,
    /\.site-header__brand,\s*\.home-section__heading a,\s*\.not-found-page a\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*min-height:\s*2\.75rem;/s
  );
});

test('renders a labeled catalog h2 between the collection h1 and card h3 headings', async (context) => {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true }
  });
  context.after(() => server.close());

  const { CollectionPage } = await server.ssrLoadModule('/src/pages/CollectionPage.jsx');
  const markup = renderToStaticMarkup(createElement(CollectionPage, {
    icons: icons.map((item) => ({ ...item, published: true })),
    onNavigate() {}
  }));
  const h1Index = markup.indexOf('<h1');
  const h2Index = markup.indexOf('<h2');
  const h3Index = markup.indexOf('<h3');

  assert.match(
    markup,
    /<section class="collection-page__catalog" aria-labelledby="collection-catalog-title"><h2 id="collection-catalog-title" class="collection-page__catalog-title">Каталог икон<\/h2>/
  );
  assert.ok(h1Index >= 0 && h1Index < h2Index && h2Index < h3Index, 'collection headings must progress h1 → h2 → h3');
});

test('the site shell remains visible during content loading and errors', async (context) => {
  const { AppView } = await loadModules(context, ['/src/App.jsx']);
  assert.equal(typeof AppView, 'function', 'AppView must expose the real shell for content-state rendering');

  const common = { route: { name: 'home' }, onNavigate() {}, retry() {} };
  const loading = renderToStaticMarkup(createElement(AppView, { ...common, status: 'loading', bundle: null, error: null }));
  const failed = renderToStaticMarkup(createElement(AppView, {
    ...common,
    status: 'error',
    bundle: null,
    error: new Error('content unavailable')
  }));

  for (const markup of [loading, failed]) {
    assert.match(markup, /<header class="site-header">/);
    assert.match(markup, /<footer[^>]*class="site-footer">/);
    assert.match(markup, /id="main-content"/);
  }
  assert.match(loading, /Загружаем коллекцию/);
  assert.match(failed, /Не удалось загрузить коллекцию/);
  assert.match(failed, /<button[^>]*>Повторить<\/button>/);
});

test('home and collection compose safely from the published catalog', async (context) => {
  const { HomePage, CollectionPage } = await loadModules(context, [
    '/src/pages/HomePage.jsx',
    '/src/pages/CollectionPage.jsx'
  ]);

  let homeMarkup = '';
  assert.doesNotThrow(() => {
    homeMarkup = renderToStaticMarkup(createElement(HomePage, { icons: [], onNavigate() {} }));
  });
  assert.match(homeMarkup, /<h1[^>]*>Иконы для молитвы/);
  assert.doesNotMatch(homeMarkup, /<img/);

  const collectionMarkup = renderToStaticMarkup(createElement(CollectionPage, {
    icons: [{ ...icon, slug: 'hidden', title: 'Скрытая икона', published: false }],
    onNavigate() {}
  }));
  assert.doesNotMatch(collectionMarkup, /Скрытая икона/);
  assert.match(collectionMarkup, /По выбранным параметрам икон нет/);
});

test('icon detail navigation follows information and hides next only for an empty published catalog', async (context) => {
  const { IconDetailPage } = await loadModules(context, ['/src/pages/IconDetailPage.jsx']);

  let emptyMarkup = '';
  assert.doesNotThrow(() => {
    emptyMarkup = renderToStaticMarkup(createElement(IconDetailPage, { icon, icons: [], onNavigate() {} }));
  });
  assert.match(emptyMarkup, /href="\/collection"[^>]*>← В каталог<\/a>/);
  assert.doesNotMatch(emptyMarkup, /Следующая икона/);

  const populatedMarkup = renderToStaticMarkup(createElement(IconDetailPage, {
    icon,
    icons: [icon],
    onNavigate() {}
  }));
  assert.match(populatedMarkup, /href="\/icons\/example"[^>]*>Следующая икона →<\/a>/);
  assert.ok(
    populatedMarkup.indexOf('Паспорт предмета') < populatedMarkup.indexOf('Навигация по коллекции') &&
      populatedMarkup.indexOf('Навигация по коллекции') < populatedMarkup.indexOf('Консультация и личный просмотр'),
    'catalog navigation must immediately follow icon information and precede consultation'
  );
  assert.doesNotMatch(populatedMarkup, /min-height:\s*100vh|height:\s*100vh/);
});

test('failed media removes the wrapper that reserved its layout footprint', async (context) => {
  const { FailureAwareImage } = await loadModules(context, ['/src/components/FailureAwareImage.jsx']);
  const instance = instantiateClassComponent(FailureAwareImage, {
    image,
    children: (renderedImage) => createElement('figure', { className: 'media-frame' }, renderedImage)
  });

  const frame = instance.render();
  assert.equal(frame.type, 'figure');
  assert.equal(frame.props.children.type, 'img');
  frame.props.children.props.onError({ type: 'error' });
  assert.equal(instance.render(), null);
});

test('contact links derive all destinations from the supplied canonical record', () => {
  const links = buildContactLinks(
    { whatsapp: '79990001122', phone: '+7 (999) 000-11-22', email: 'atelier@example.test' },
    'Архистратиг Михаил'
  );

  assert.match(links.whatsapp, /^https:\/\/wa\.me\/79990001122\?text=/);
  assert.equal(links.phone, 'tel:+79990001122');
  assert.match(links.email, /^mailto:atelier@example\.test\?/);
  assert.match(decodeURIComponent(links.whatsapp), /Архистратиг Михаил/);
});

test('whitespace-only text sections are excluded before layout', () => {
  const visible = { type: 'text', heading: '  Мастерская  ', paragraphs: ['   ', 'Текст'] };
  assert.deepEqual(renderableSections([
    { type: 'text', heading: '   ', paragraphs: ['\n', '\t'] },
    visible
  ]), [visible]);
});

test('clicking the video trigger replaces it with a non-autoplay iframe', async (context) => {
  const { VideoEmbed } = await loadModules(context, ['/src/components/VideoEmbed.jsx']);
  assert.ok(VideoEmbed.prototype instanceof Component, 'the real video component must expose its interaction state');

  const instance = instantiateClassComponent(VideoEmbed, {
    video: { provider: 'youtube', id: 'y10sw1KIOqQ', title: 'Иконописная мастерская' }
  });
  const inactiveMarkup = renderToStaticMarkup(instance.render());
  assert.match(inactiveMarkup, /<button[^>]*>.*Смотреть видео.*<\/button>/s);
  assert.doesNotMatch(inactiveMarkup, /<iframe/);

  const trigger = instance.render().props.children;
  trigger.props.onClick();
  const activeMarkup = renderToStaticMarkup(instance.render());
  assert.match(activeMarkup, /<iframe[^>]*src="https:\/\/www\.youtube-nocookie\.com\/embed\/y10sw1KIOqQ\?autoplay=0"/);
  assert.doesNotMatch(activeMarkup, /<button/);
});
