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
    enqueueSetState(instance, update, callback) {
      const previousState = instance.state;
      const nextState = typeof update === 'function' ? update(instance.state, instance.props) : update;
      instance.state = { ...instance.state, ...nextState };
      instance.componentDidUpdate?.(instance.props, previousState);
      callback?.call(instance);
    }
  };
  return new ComponentType(props, undefined, updater);
}

function findElements(node, predicate, matches = []) {
  if (!node || typeof node !== 'object') return matches;
  if (predicate(node)) matches.push(node);
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    findElements(child, predicate, matches);
  }
  return matches;
}

function renderedBoundaryFor(iconImageElement) {
  const boundaryElement = iconImageElement.type(iconImageElement.props);
  const boundary = instantiateClassComponent(boundaryElement.type, boundaryElement.props);
  const rendered = boundary.render();
  const imageElement = findElements(rendered, (element) => element.type === 'img')[0];
  assert.ok(imageElement, 'the image boundary must render a real img before failure');
  return { boundary, imageElement, rendered };
}

function declarationsFor(styles, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing CSS rule for ${selector}`);
  return Object.fromEntries(match[1]
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .map((declaration) => {
      const separator = declaration.indexOf(':');
      return [declaration.slice(0, separator).trim(), declaration.slice(separator + 1).trim()];
    }));
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

test('rendered icon images preserve dimensions, aspect ratio, and caller loading policy', async (context) => {
  const { IconImage } = await loadModules(context, ['/src/components/IconImage.jsx']);
  const eagerMarkup = renderToStaticMarkup(createElement(IconImage, { image, title: 'Икона', mode: 'full', eager: true }));
  const lazyMarkup = renderToStaticMarkup(createElement(IconImage, { image, title: 'Икона' }));

  assert.match(eagerMarkup, /<img[^>]*width="1200"[^>]*height="1600"[^>]*loading="eager"/);
  assert.match(eagerMarkup, /style="[^"]*aspect-ratio:1200 \/ 1600[^"]*object-fit:contain/);
  assert.match(lazyMarkup, /<img[^>]*loading="lazy"/);
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
  const styles = await source('styles.css');

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
  const contentRules = declarationsFor(styles, '.icon-detail-page__content');
  const navigationRules = declarationsFor(styles, '.icon-detail-page__navigation');
  assert.equal(contentRules.gap, '1.5rem');
  assert.equal(contentRules.height, undefined);
  assert.equal(contentRules['min-height'], undefined);
  assert.equal(navigationRules['padding-block'], '1rem');
});

test('failure-aware images reset their failure state for a replacement source', async (context) => {
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

  instance.props = {
    ...instance.props,
    image: { ...image, src: '/assets/icons/replacement.jpg' }
  };
  const replacementFrame = instance.render();
  assert.equal(replacementFrame.type, 'figure');
  assert.equal(replacementFrame.props.children.props.src, '/assets/icons/replacement.jpg');
});

test('icon cards promote image candidates and remove the whole card only after all fail', async (context) => {
  const { IconCard } = await loadModules(context, ['/src/components/IconCard.jsx']);
  assert.ok(IconCard.prototype instanceof Component, 'the card must own fallback state across image candidates');

  const candidates = [
    image,
    { ...image, src: '/assets/icons/example-detail.jpg', alt: 'Икона, деталь' }
  ];
  const instance = instantiateClassComponent(IconCard, { icon: { ...icon, images: candidates }, onNavigate() {} });

  let card = instance.render();
  assert.equal(card.type, 'article');
  let renderedImages = findElements(card, (element) => element.type?.name === 'IconImage');
  assert.equal(renderedImages[0].props.image.src, candidates[0].src);
  renderedBoundaryFor(renderedImages[0]).imageElement.props.onError({ type: 'error' });

  card = instance.render();
  renderedImages = findElements(card, (element) => element.type?.name === 'IconImage');
  assert.equal(renderedImages[0].props.image.src, candidates[1].src);
  renderedBoundaryFor(renderedImages[0]).imageElement.props.onError({ type: 'error' });
  assert.equal(instance.render(), null, 'no text-only card footprint may remain after the final candidate fails');
});

test('an open gallery promotes a valid image, then closes and releases the page after the last failure', async (context) => {
  const { IconGallery } = await loadModules(context, ['/src/components/IconGallery.jsx']);
  assert.ok(IconGallery.prototype instanceof Component, 'the gallery must expose composite dialog failure state');

  const candidates = [
    image,
    { ...image, src: '/assets/icons/example-detail.jpg', alt: 'Икона, деталь' }
  ];
  const originalDocument = globalThis.document;
  const main = { focusCount: 0, setAttribute() {}, focus() { this.focusCount += 1; } };
  globalThis.document = {
    activeElement: null,
    body: { style: { overflow: 'auto' } },
    getElementById(id) { return id === 'main-content' ? main : null; }
  };

  try {
    const instance = instantiateClassComponent(IconGallery, { images: candidates, title: icon.title });
    const dialog = {
      open: false,
      closeCount: 0,
      showModal() { this.open = true; },
      close() { this.open = false; this.closeCount += 1; },
      querySelector() { return { focus() {} }; }
    };
    const trigger = { isConnected: true, focusCount: 0, focus() { this.focusCount += 1; } };
    instance.dialogRef.current = dialog;

    instance.openImage(candidates[0].src, trigger);
    assert.equal(instance.state.isOpen, true);
    assert.equal(instance.state.activeSrc, candidates[0].src);
    assert.equal(dialog.open, true);
    assert.equal(document.body.style.overflow, 'hidden');

    let galleryImages = findElements(instance.render(), (element) => element.type?.name === 'IconImage');
    let activeImage = galleryImages.at(-1);
    assert.equal(activeImage.props.image.src, candidates[0].src);
    renderedBoundaryFor(activeImage).imageElement.props.onError({ type: 'error' });

    assert.equal(instance.state.isOpen, true);
    assert.equal(instance.state.activeSrc, candidates[1].src);
    assert.equal(document.body.style.overflow, 'hidden');
    galleryImages = findElements(instance.render(), (element) => element.type?.name === 'IconImage');
    activeImage = galleryImages.at(-1);
    assert.equal(activeImage.props.image.src, candidates[1].src);

    trigger.isConnected = false;
    renderedBoundaryFor(activeImage).imageElement.props.onError({ type: 'error' });
    assert.equal(instance.state.isOpen, false);
    assert.equal(instance.render(), null);
    assert.equal(dialog.open, false);
    assert.equal(dialog.closeCount, 1);
    assert.equal(document.body.style.overflow, 'auto');
    assert.equal(trigger.focusCount, 0);
    assert.equal(main.focusCount, 1, 'focus must move to main content when the original trigger was removed');
  } finally {
    globalThis.document = originalDocument;
  }
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

test('rendered headings, paragraphs, and prices use trimmed visibility rules', async (context) => {
  const { ContentSections, IconCard, IconDetailPage } = await loadModules(context, [
    '/src/components/ContentSections.jsx',
    '/src/components/IconCard.jsx',
    '/src/pages/IconDetailPage.jsx'
  ]);
  const sectionsMarkup = renderToStaticMarkup(createElement(ContentSections, {
    sections: [{ type: 'text', heading: '   ', paragraphs: ['\n', '  Содержательный текст  '] }]
  }));
  assert.doesNotMatch(sectionsMarkup, /<h2/);
  assert.match(sectionsMarkup, /<p>Содержательный текст<\/p>/);

  const whitespaceIcon = { ...icon, price: '   ', period: '   ', type: '\t' };
  const cardMarkup = renderToStaticMarkup(createElement(IconCard, { icon: whitespaceIcon, onNavigate() {} }));
  const detailMarkup = renderToStaticMarkup(createElement(IconDetailPage, {
    icon: whitespaceIcon,
    icons: [whitespaceIcon],
    onNavigate() {}
  }));
  assert.match(cardMarkup, /Цена по запросу/);
  assert.doesNotMatch(cardMarkup, /<p class="icon-card__period">\s*<\/p>/);
  assert.match(detailMarkup, /<p class="icon-detail-page__price">Цена по запросу<\/p>/);
  assert.doesNotMatch(detailMarkup, /<p class="eyebrow">\s*<\/p>/);
});

test('header closes both disclosures before hiding focus and moves focus after navigation', async (context) => {
  const { SiteHeader } = await loadModules(context, ['/src/components/SiteHeader.jsx']);
  assert.ok(SiteHeader.prototype instanceof Component, 'the header must expose coordinated disclosure state');

  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  let currentMain = { focusCount: 0, setAttribute() {}, focus() { this.focusCount += 1; } };
  globalThis.document = {
    activeElement: null,
    getElementById(id) { return id === 'main-content' ? currentMain : null; }
  };
  globalThis.window = { requestAnimationFrame(callback) { callback(); } };

  try {
    const navigated = [];
    const instance = instantiateClassComponent(SiteHeader, {
      onNavigate(path) {
        navigated.push(path);
        currentMain = { focusCount: 0, setAttribute() {}, focus() { this.focusCount += 1; } };
      }
    });
    const menuButton = {
      focusCount: 0,
      focus() {
        assert.equal(instance.state.isOpen, true, 'mobile content must still be visible when its controller receives focus');
        this.focusCount += 1;
      }
    };
    const workshopSummary = {
      focusCount: 0,
      focus() {
        assert.equal(workshop.open, true, 'workshop content must still be visible when its summary receives focus');
        this.focusCount += 1;
      }
    };
    const workshopChild = {};
    const workshop = {
      open: true,
      contains(node) { return node === workshopChild; },
      querySelector() { return workshopSummary; }
    };
    instance.menuButtonRef.current = menuButton;
    instance.workshopRef.current = workshop;

    instance.state = { isOpen: true };
    document.activeElement = workshopChild;
    instance.handleKeyDown({ key: 'Escape' });
    assert.equal(instance.state.isOpen, false);
    assert.equal(workshop.open, false);
    assert.equal(menuButton.focusCount, 1);

    workshop.open = true;
    document.activeElement = workshopChild;
    instance.handleKeyDown({ key: 'Escape' });
    assert.equal(workshop.open, false);
    assert.equal(workshopSummary.focusCount, 1);

    instance.state = { isOpen: true };
    workshop.open = true;
    document.activeElement = workshopChild;
    const event = { preventDefault() {}, defaultPrevented: false, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
    instance.follow(event, '/articles');
    assert.deepEqual(navigated, ['/articles']);
    assert.equal(instance.state.isOpen, false);
    assert.equal(workshop.open, false);
    assert.equal(currentMain.focusCount, 1, 'navigation must focus the newly rendered main content');
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
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
