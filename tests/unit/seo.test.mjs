import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSeoDescriptor, listCanonicalPaths, serializeJsonLd, updateManagedSeo } from '../../src/lib/seo.js';

const image = {
  src: '/assets/icons/example.jpg',
  alt: 'Икона, полный вид',
  width: 1200,
  height: 1600,
};

const bundle = {
  icons: [
    {
      slug: 'first-icon', title: 'Первая икона', published: true,
      description: '<p>Описание первой иконы.</p>', images: [image],
      price: '100 000 руб.', availability: 'В наличии',
    },
    {
      slug: 'second-icon', title: 'Вторая икона', published: true,
      description: 'Описание второй иконы.', images: [image],
      price: '100 000 руб.', availability: 'По запросу',
    },
    { slug: 'hidden-icon', title: 'Скрытая', published: false, images: [image] },
  ],
  pages: [
    {
      slug: 'workshop', title: 'Мастерская', published: true,
      sections: [{ type: 'text', paragraphs: ['Описание мастерской.'] }],
    },
    {
      slug: 'raschistka-hramovyh-rospisey',
      title: 'Расчистка настенных храмовых росписей от копоти',
      intro: 'Бережно расчищаем храмовую стенопись.',
      template: 'service',
      published: true,
    },
    { slug: 'hidden-page', title: 'Скрытая страница', published: false },
  ],
  articles: [
    {
      slug: 'first-article', title: 'Первая статья', published: true,
      sections: [{ type: 'text', paragraphs: ['Текст первой статьи.'] }],
    },
    { slug: 'hidden-article', title: 'Скрытая статья', published: false },
  ],
  videos: [{ title: 'Видео', published: true }],
  contacts: {
    phone: '+79166554595',
    email: 'iconamaster@yandex.ru',
    address: {
      display: 'Московская область, д. Брёхово, Ромашковая ул., 16',
      streetAddress: 'Ромашковая ул., 16',
      addressLocality: 'д. Брёхово',
      addressRegion: 'Московская область',
      addressCountry: 'RU',
    },
  },
  aliases: { '/old-page': '/workshop' },
};

test('lists only published canonical paths in content order', () => {
  assert.deepEqual(listCanonicalPaths(bundle), [
    '/',
    '/collection',
    '/icons/first-icon',
    '/icons/second-icon',
    '/workshop',
    '/raschistka-hramovyh-rospisey',
    '/articles',
    '/articles/first-article',
    '/video',
    '/contacts',
  ]);
});

test('builds canonical descriptors and structured data for every route type', () => {
  const home = buildSeoDescriptor('/', bundle);
  const service = buildSeoDescriptor('/raschistka-hramovyh-rospisey', bundle);
  const article = buildSeoDescriptor('/articles/first-article', bundle);
  const icon = buildSeoDescriptor('/icons/first-icon', bundle);
  const incompleteIcon = buildSeoDescriptor('/icons/second-icon', bundle);
  const contacts = buildSeoDescriptor('/contacts', bundle);
  const missing = buildSeoDescriptor('/missing', bundle);

  assert.equal(home.canonical, 'https://iconamaster.ru/');
  assert.match(JSON.stringify(home.structuredData), /"LocalBusiness"/u);
  assert.match(service.title, /Расчистка настенных храмовых росписей/u);
  assert.match(JSON.stringify(service.structuredData), /"Service"/u);
  assert.equal(article.openGraph.type, 'article');
  assert.match(JSON.stringify(article.structuredData), /"Article"/u);
  assert.equal(icon.openGraph.image, 'https://iconamaster.ru/assets/icons/example.jpg');
  assert.match(JSON.stringify(icon.structuredData), /"VisualArtwork"/u);
  assert.match(JSON.stringify(icon.structuredData), /"Offer"/u);
  assert.doesNotMatch(JSON.stringify(incompleteIcon.structuredData), /"Offer"/u);
  assert.match(JSON.stringify(contacts.structuredData), /Ромашковая ул\., 16/u);
  assert.match(JSON.stringify(contacts.structuredData), /"LocalBusiness"/u);
  assert.equal(missing.robots, 'noindex,follow');
  assert.match(JSON.stringify(article.structuredData), /"BreadcrumbList"/u);
});

test('serializes JSON-LD without allowing a script close tag', () => {
  assert.equal(JSON.parse(serializeJsonLd({ text: '</script>' })).text, '</script>');
  assert.doesNotMatch(serializeJsonLd({ text: '</script>' }), /<\/script>/u);
});

test('does not treat descriptive text containing rubles as a numeric sale price', () => {
  const invalidPriceBundle = structuredClone(bundle);
  invalidPriceBundle.icons[0].price = 'Стоимость от 100 000 руб. уточняйте';

  const descriptor = buildSeoDescriptor('/icons/first-icon', invalidPriceBundle);

  assert.doesNotMatch(JSON.stringify(descriptor.structuredData), /"Product"/u);
  assert.doesNotMatch(JSON.stringify(descriptor.structuredData), /"Offer"/u);
});

test('keeps protocol-relative malformed paths on the canonical site origin', () => {
  const descriptor = buildSeoDescriptor('//evil.example/path', bundle);

  assert.equal(descriptor.canonical, 'https://iconamaster.ru/');
  assert.equal(descriptor.openGraph.url, 'https://iconamaster.ru/');
  assert.equal(descriptor.robots, 'noindex,follow');
});

class HeadElement {
  constructor(tagName, attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map(Object.entries(attributes));
    this.textContent = '';
    this.removed = false;
  }

  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  remove() { this.removed = true; }
}

function fakeDocument(elements) {
  return {
    head: { append: (element) => elements.push(element) },
    createElement: (tagName) => new HeadElement(tagName),
    querySelectorAll: (selector) => {
      const matches = [...selector.matchAll(/\[([^=\]]+)="([^"]+)"\]/gu)];
      const tagName = selector.match(/^[a-z]+/iu)?.[0]?.toUpperCase();
      return elements.filter((element) => !element.removed
        && (!tagName || element.tagName === tagName)
        && matches.every(([, name, value]) => element.getAttribute(name) === value));
    },
  };
}

test('updates only managed SEO nodes and reconciles optional metadata without duplicates', () => {
  const unownedDescription = new HeadElement('meta', { name: 'description' });
  unownedDescription.setAttribute('content', 'Не изменять');
  const title = new HeadElement('title', { 'data-seo-managed': 'true' });
  const description = new HeadElement('meta', { 'data-seo-managed': 'true', name: 'description' });
  const canonical = new HeadElement('link', { 'data-seo-managed': 'true', rel: 'canonical' });
  const duplicateCanonical = new HeadElement('link', { 'data-seo-managed': 'true', rel: 'canonical' });
  const jsonLd = new HeadElement('script', { 'data-seo-managed': 'true', type: 'application/ld+json' });
  const elements = [unownedDescription, title, description, canonical, duplicateCanonical, jsonLd];
  const documentLike = fakeDocument(elements);
  const descriptor = buildSeoDescriptor('/icons/first-icon', bundle);

  updateManagedSeo(documentLike, descriptor);

  assert.equal(title.textContent, descriptor.title);
  assert.equal(description.getAttribute('content'), descriptor.description);
  assert.equal(unownedDescription.getAttribute('content'), 'Не изменять');
  assert.equal(canonical.getAttribute('href'), 'https://iconamaster.ru/icons/first-icon');
  assert.equal(duplicateCanonical.removed, true);
  assert.equal(JSON.parse(jsonLd.textContent)['@context'], 'https://schema.org');
  assert.equal(documentLike.querySelectorAll('link[rel="canonical"][data-seo-managed="true"]').length, 1);
  assert.equal(documentLike.querySelectorAll('meta[property="og:image"][data-seo-managed="true"]').length, 1);
  assert.equal(documentLike.querySelectorAll('script[type="application/ld+json"][data-seo-managed="true"]').length, 1);
});

test('removes stale managed image metadata when the next route has no image', () => {
  const ogImage = new HeadElement('meta', {
    'data-seo-managed': 'true',
    property: 'og:image',
    content: 'https://iconamaster.ru/assets/icons/example.jpg',
  });
  const twitterImage = new HeadElement('meta', {
    'data-seo-managed': 'true',
    name: 'twitter:image',
    content: 'https://iconamaster.ru/assets/icons/example.jpg',
  });
  const elements = [ogImage, twitterImage];

  updateManagedSeo(fakeDocument(elements), buildSeoDescriptor('/contacts', bundle));

  assert.equal(ogImage.removed, true);
  assert.equal(twitterImage.removed, true);
});
