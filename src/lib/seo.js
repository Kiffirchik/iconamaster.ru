import { siteConfig } from '../data/site-config.js';
import { normalizePath } from './routing.js';

const siteUrl = siteConfig.url.replace(/\/$/u, '');
const localBusinessId = `${siteUrl}/#business`;
const saleAvailability = new Map([
  ['В наличии', 'https://schema.org/InStock'],
]);

function isPublished(record) {
  return record?.published !== false;
}

function canonicalPath(pathname) {
  const path = normalizePath(pathname);
  return path?.startsWith('/') && !path.startsWith('//') ? path : null;
}

function absoluteUrl(path) {
  return new URL(path, `${siteUrl}/`).href;
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function truncateDescription(value, limit = 160) {
  const text = normalizeText(value);
  if (text.length <= limit) return text;

  const boundary = text.lastIndexOf(' ', limit - 1);
  return `${text.slice(0, boundary > 0 ? boundary : limit - 1).trim()}…`;
}

function firstTextSection(sections) {
  for (const section of Array.isArray(sections) ? sections : []) {
    if (section?.type !== 'text') continue;
    const text = [section.heading, ...(Array.isArray(section.paragraphs) ? section.paragraphs : [])]
      .map(normalizeText)
      .find(Boolean);
    if (text) return text;
  }
  return '';
}

function recordDescription(record, fallback) {
  return truncateDescription(record?.intro || record?.description || firstTextSection(record?.sections) || fallback);
}

function recordImage(record) {
  const directImage = record?.image?.src;
  const image = directImage || record?.images?.find((candidate) => candidate?.src)?.src;
  return image ? absoluteUrl(image) : null;
}

function findPublished(records, slug) {
  return (Array.isArray(records) ? records : []).find(
    (record) => record?.slug === slug && isPublished(record)
  ) ?? null;
}

function localBusiness(contacts = {}) {
  const address = contacts.address;
  return {
    '@type': 'LocalBusiness',
    '@id': localBusinessId,
    name: siteConfig.name,
    url: `${siteUrl}/`,
    ...(contacts.phone ? { telephone: contacts.phone } : {}),
    ...(contacts.email ? { email: contacts.email } : {}),
    ...(address ? {
      address: {
        '@type': 'PostalAddress',
        streetAddress: address.streetAddress,
        addressLocality: address.addressLocality,
        addressRegion: address.addressRegion,
        addressCountry: address.addressCountry,
      }
    } : {}),
  };
}

function breadcrumb(title, canonical) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: siteConfig.name,
        item: `${siteUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: title,
        item: canonical,
      },
    ],
  };
}

function parseRubPrice(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^((?:\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)(?:[.,]\d{1,2})?)\s*(?:руб\.?|₽)$/iu);
  if (!match) return null;

  const price = Number(match[1].replace(/[\s\u00a0]/gu, '').replace(',', '.'));
  return Number.isFinite(price) && price > 0 ? price : null;
}

function productForIcon(icon, canonical, image, description) {
  const price = parseRubPrice(icon.price);
  const availability = saleAvailability.get(normalizeText(icon.availability));
  if (!price || !availability) return null;

  return {
    '@type': 'Product',
    name: normalizeText(icon.title),
    ...(image ? { image } : {}),
    description,
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: 'RUB',
      availability,
      url: canonical,
    },
  };
}

function descriptorFor(path, bundle) {
  const canonical = absoluteUrl(path);
  const route = { title: siteConfig.name, description: '', type: 'website', image: null, graph: [] };

  if (path === '/') {
    route.description = 'Московская иконописная мастерская: иконы, реставрация и храмовые росписи.';
    route.graph.push(localBusiness(bundle?.contacts));
    return route;
  }

  if (path === '/collection') {
    route.title = `Иконы | ${siteConfig.name}`;
    route.description = 'Коллекция икон Московской иконописной мастерской.';
    return route;
  }

  if (path === '/articles') {
    route.title = `Статьи | ${siteConfig.name}`;
    route.description = 'Статьи об иконописи, иконах и церковном искусстве.';
    return route;
  }

  if (path === '/video') {
    route.title = `Видео | ${siteConfig.name}`;
    route.description = 'Видео Московской иконописной мастерской.';
    return route;
  }

  if (path === '/contacts') {
    route.title = `Контакты | ${siteConfig.name}`;
    route.description = 'Контакты Московской иконописной мастерской.';
    route.graph.push(localBusiness(bundle?.contacts));
    return route;
  }

  const iconMatch = path.match(/^\/icons\/([^/]+)$/u);
  if (iconMatch) {
    const icon = findPublished(bundle?.icons, iconMatch[1]);
    if (!icon) return null;
    route.title = `${normalizeText(icon.title)} | ${siteConfig.name}`;
    route.description = recordDescription(icon, icon.title);
    route.image = recordImage(icon);
    route.graph.push({
      '@type': 'VisualArtwork',
      name: normalizeText(icon.title),
      description: route.description,
      ...(route.image ? { image: route.image } : {}),
    });
    const product = productForIcon(icon, canonical, route.image, route.description);
    if (product) route.graph.push(product);
    return route;
  }

  const articleMatch = path.match(/^\/articles\/([^/]+)$/u);
  if (articleMatch) {
    const article = findPublished(bundle?.articles, articleMatch[1]);
    if (!article) return null;
    route.title = `${normalizeText(article.title)} | ${siteConfig.name}`;
    route.description = recordDescription(article, article.title);
    route.type = 'article';
    route.image = recordImage(article);
    route.graph.push({
      '@type': 'Article',
      headline: normalizeText(article.title),
      description: route.description,
      mainEntityOfPage: canonical,
      ...(route.image ? { image: route.image } : {}),
    });
    return route;
  }

  const pageMatch = path.match(/^\/([^/]+)$/u);
  if (pageMatch) {
    const page = findPublished(bundle?.pages, pageMatch[1]);
    if (!page) return null;
    route.title = `${normalizeText(page.title)} | ${siteConfig.name}`;
    route.description = recordDescription(page, page.title);
    route.image = recordImage(page);
    if (page.template === 'service') {
      route.graph.push({
        '@type': 'Service',
        name: normalizeText(page.title),
        description: route.description,
        provider: { '@id': localBusinessId },
      });
    }
    return route;
  }

  return null;
}

export function listCanonicalPaths(bundle) {
  const paths = ['/', '/collection'];
  for (const icon of Array.isArray(bundle?.icons) ? bundle.icons : []) {
    if (isPublished(icon) && icon?.slug) paths.push(`/icons/${icon.slug}`);
  }
  for (const page of Array.isArray(bundle?.pages) ? bundle.pages : []) {
    if (isPublished(page) && page?.slug) paths.push(`/${page.slug}`);
  }
  paths.push('/articles');
  for (const article of Array.isArray(bundle?.articles) ? bundle.articles : []) {
    if (isPublished(article) && article?.slug) paths.push(`/articles/${article.slug}`);
  }
  if ((Array.isArray(bundle?.videos) ? bundle.videos : []).some(isPublished)) paths.push('/video');
  if (bundle?.contacts) paths.push('/contacts');
  return [...new Set(paths)];
}

export function buildSeoDescriptor(pathname, bundle) {
  const path = canonicalPath(pathname);
  const canonical = absoluteUrl(path || '/');
  const route = path && descriptorFor(path, bundle);

  if (!route) {
    const title = `Страница не найдена | ${siteConfig.name}`;
    const description = 'Запрошенная страница не найдена.';
    return {
      title,
      description,
      canonical,
      robots: 'noindex,follow',
      openGraph: { title, description, url: canonical, type: 'website', locale: siteConfig.locale, image: null },
      twitter: { card: 'summary', title, description, image: null },
      structuredData: { '@context': 'https://schema.org', '@graph': [] },
    };
  }

  const graph = [...route.graph];
  if (path !== '/') graph.push(breadcrumb(route.title, canonical));
  return {
    title: route.title,
    description: route.description,
    canonical,
    robots: 'index,follow',
    openGraph: {
      title: route.title,
      description: route.description,
      url: canonical,
      type: route.type,
      locale: siteConfig.locale,
      image: route.image,
    },
    twitter: {
      card: route.image ? 'summary_large_image' : 'summary',
      title: route.title,
      description: route.description,
      image: route.image,
    },
    structuredData: { '@context': 'https://schema.org', '@graph': graph },
  };
}

export function serializeJsonLd(value) {
  return (JSON.stringify(value) ?? 'null')
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}

const managedAttribute = 'data-seo-managed';

function reconcileHeadNode(documentLike, { tagName, selector, attributes = {}, value, property }) {
  const matches = [...documentLike.querySelectorAll(selector)];
  const managed = matches.filter((node) => node.getAttribute(managedAttribute) === 'true');

  if (value === null || value === undefined || value === '') {
    for (const node of managed) node.remove();
    return;
  }

  let node = managed.shift();
  for (const duplicate of managed) duplicate.remove();

  if (!node) {
    if (matches.length > 0) return;
    node = documentLike.createElement(tagName);
    node.setAttribute(managedAttribute, 'true');
    for (const [name, attributeValue] of Object.entries(attributes)) {
      node.setAttribute(name, attributeValue);
    }
    documentLike.head.append(node);
  }

  if (property === 'textContent') node.textContent = value;
  else node.setAttribute(property, value);
}

export function updateManagedSeo(documentLike, descriptor) {
  if (!documentLike?.head || typeof documentLike.querySelectorAll !== 'function') return false;

  const entries = [
    { tagName: 'title', selector: 'title', value: descriptor.title, property: 'textContent' },
    { tagName: 'meta', selector: 'meta[name="description"]', attributes: { name: 'description' }, value: descriptor.description, property: 'content' },
    { tagName: 'meta', selector: 'meta[name="robots"]', attributes: { name: 'robots' }, value: descriptor.robots, property: 'content' },
    { tagName: 'link', selector: 'link[rel="canonical"]', attributes: { rel: 'canonical' }, value: descriptor.canonical, property: 'href' },
    { tagName: 'meta', selector: 'meta[property="og:title"]', attributes: { property: 'og:title' }, value: descriptor.openGraph.title, property: 'content' },
    { tagName: 'meta', selector: 'meta[property="og:description"]', attributes: { property: 'og:description' }, value: descriptor.openGraph.description, property: 'content' },
    { tagName: 'meta', selector: 'meta[property="og:url"]', attributes: { property: 'og:url' }, value: descriptor.openGraph.url, property: 'content' },
    { tagName: 'meta', selector: 'meta[property="og:type"]', attributes: { property: 'og:type' }, value: descriptor.openGraph.type, property: 'content' },
    { tagName: 'meta', selector: 'meta[property="og:locale"]', attributes: { property: 'og:locale' }, value: descriptor.openGraph.locale, property: 'content' },
    { tagName: 'meta', selector: 'meta[property="og:image"]', attributes: { property: 'og:image' }, value: descriptor.openGraph.image, property: 'content' },
    { tagName: 'meta', selector: 'meta[name="twitter:card"]', attributes: { name: 'twitter:card' }, value: descriptor.twitter.card, property: 'content' },
    { tagName: 'meta', selector: 'meta[name="twitter:title"]', attributes: { name: 'twitter:title' }, value: descriptor.twitter.title, property: 'content' },
    { tagName: 'meta', selector: 'meta[name="twitter:description"]', attributes: { name: 'twitter:description' }, value: descriptor.twitter.description, property: 'content' },
    { tagName: 'meta', selector: 'meta[name="twitter:image"]', attributes: { name: 'twitter:image' }, value: descriptor.twitter.image, property: 'content' },
    {
      tagName: 'script',
      selector: 'script[type="application/ld+json"]',
      attributes: { type: 'application/ld+json' },
      value: serializeJsonLd(descriptor.structuredData),
      property: 'textContent',
    },
  ];

  for (const entry of entries) reconcileHeadNode(documentLike, entry);
  return true;
}
