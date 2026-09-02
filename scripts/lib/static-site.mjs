import path from 'node:path';

import { serializeJsonLd } from '../../src/lib/seo.js';

const markers = {
  seo: '<!-- ICONAMASTER_SEO -->',
  analytics: '<!-- ICONAMASTER_ANALYTICS -->',
  app: '<!-- ICONAMASTER_APP -->',
  noscript: '<!-- ICONAMASTER_NOSCRIPT -->',
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');
}

function requireUniqueMarker(template, marker) {
  const occurrences = template.split(marker).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Expected exactly one ${marker.slice(5, -4)} marker, found ${occurrences}`);
  }
}

function managedMeta(attribute, key, value) {
  if (value === null || value === undefined || value === '') return '';
  return `<meta ${attribute}="${escapeHtml(key)}" content="${escapeHtml(value)}" data-seo-managed="true" />`;
}

function renderSeo(seo) {
  const lines = [
    managedMeta('name', 'description', seo.description),
    managedMeta('name', 'robots', seo.robots),
    `<link rel="canonical" href="${escapeHtml(seo.canonical)}" data-seo-managed="true" />`,
    managedMeta('property', 'og:title', seo.openGraph.title),
    managedMeta('property', 'og:description', seo.openGraph.description),
    managedMeta('property', 'og:url', seo.openGraph.url),
    managedMeta('property', 'og:type', seo.openGraph.type),
    managedMeta('property', 'og:locale', seo.openGraph.locale),
    managedMeta('property', 'og:image', seo.openGraph.image),
    managedMeta('name', 'twitter:card', seo.twitter.card),
    managedMeta('name', 'twitter:title', seo.twitter.title),
    managedMeta('name', 'twitter:description', seo.twitter.description),
    managedMeta('name', 'twitter:image', seo.twitter.image),
    `<script type="application/ld+json" data-seo-managed="true">${serializeJsonLd(seo.structuredData)}</script>`,
  ];
  return lines.filter(Boolean).join('\n    ');
}

function renderMetrika(metrikaId) {
  if (!Number.isSafeInteger(metrikaId) || metrikaId <= 0) {
    throw new Error('Metrika ID must be a positive safe integer');
  }
  return `<script data-metrika="${metrikaId}">
  (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1;
  k.src=r;a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
  ym(${metrikaId},'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});
</script>`;
}

function validateCleanLocalPath(value, label) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    throw new Error(`${label} must be a local absolute path`);
  }
  if (value !== '/' && value.endsWith('/')) throw new Error(`${label} must be a clean path`);
  if (/%/u.test(value)) throw new Error(`${label} must not contain percent encoding`);
  if (/[\\\s\0?#"']/u.test(value)) throw new Error(`${label} contains unsafe path characters`);

  const segments = value.slice(1).split('/');
  if (segments.some((segment) => segment === '.' || segment === '..' || segment === '')) {
    if (value !== '/') throw new Error(`${label} contains an empty or dot path segment`);
  }
  return value;
}

function xmlEscape(value) {
  return escapeHtml(value).replace(/&#39;/gu, '&apos;');
}

function escapeRewritePattern(value) {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&');
}

function replaceUniqueMarker(template, marker, replacement) {
  requireUniqueMarker(template, marker);
  return template.replace(marker, replacement);
}

export function renderDocument(template, { pathname, appHtml, seo, metrikaId }) {
  for (const marker of Object.values(markers)) requireUniqueMarker(template, marker);
  const appShell = `<div id="root">${markers.app}</div>`;
  if (!template.includes(appShell)) {
    throw new Error('ICONAMASTER_APP marker must be inside the root element');
  }

  const titles = template.match(/<title\b[^>]*>[\s\S]*?<\/title>/giu) ?? [];
  if (titles.length !== 1) throw new Error(`Expected exactly one fallback title, found ${titles.length}`);

  let document = template.replace(
    titles[0],
    `<title data-seo-managed="true">${escapeHtml(seo.title)}</title>`,
  );
  document = replaceUniqueMarker(document, markers.seo, renderSeo(seo));
  document = replaceUniqueMarker(document, markers.analytics, renderMetrika(metrikaId));
  document = document.replace(
    appShell,
    `<div id="root" data-prerender-path="${escapeHtml(pathname)}">${appHtml}</div>`,
  );
  document = replaceUniqueMarker(
    document,
    markers.noscript,
    `<noscript><div><img src="https://mc.yandex.ru/watch/${metrikaId}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>`,
  );
  return document;
}

export function buildSitemap(paths, siteUrl) {
  const baseUrl = new URL(siteUrl);
  if (baseUrl.protocol !== 'https:' || baseUrl.pathname !== '/' || baseUrl.search || baseUrl.hash) {
    throw new Error('Sitemap site URL must be an HTTPS origin');
  }
  const entries = paths.map((pathname) => {
    validateCleanLocalPath(pathname, 'Sitemap route');
    return `  <url><loc>${xmlEscape(new URL(pathname, baseUrl).href)}</loc></url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

export function buildRobots(sitemapUrl) {
  const url = new URL(sitemapUrl);
  if (url.protocol !== 'https:') throw new Error('Sitemap URL must use HTTPS');
  return `User-agent: *\nAllow: /\nDisallow: /corona/\nDisallow: /captcha/\nSitemap: ${url.href}\n`;
}

export function outputPathForRoute(distRoot, pathname) {
  validateCleanLocalPath(pathname, 'Output route');
  const segments = pathname === '/' ? [] : pathname.slice(1).split('/');
  const candidate = path.join(distRoot, ...segments, 'index.html');
  const resolvedRoot = path.resolve(distRoot);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Route output escapes distribution root: ${pathname}`);
  }
  return candidate;
}

export function buildApacheConfig(baseTemplate, { canonicalPaths, aliases }) {
  const canonical = new Set();
  for (const pathname of canonicalPaths) {
    validateCleanLocalPath(pathname, 'Canonical route');
    if (canonical.has(pathname)) throw new Error(`Duplicate canonical route: ${pathname}`);
    canonical.add(pathname);
  }

  const routeRules = [...canonical]
    .filter((pathname) => pathname !== '/')
    .sort()
    .flatMap((pathname) => {
      const route = pathname.slice(1);
      const pattern = escapeRewritePattern(route);
      return [
        `RewriteRule ^${pattern}/$ ${pathname} [R=301,L,NE]`,
        `RewriteRule ^${pattern}$ ${route}/index.html [L]`,
      ];
    })
    .join('\n');

  if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) {
    throw new Error('Aliases must be an object');
  }
  const aliasRules = Object.entries(aliases)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([source, target]) => {
      validateCleanLocalPath(source, 'Alias source');
      validateCleanLocalPath(target, 'Alias target');
      if (!canonical.has(target)) throw new Error(`Alias target is not canonical: ${target}`);
      if (canonical.has(source)) throw new Error(`Alias source is already canonical: ${source}`);
      return `RewriteRule ^${escapeRewritePattern(source.slice(1))}$ ${target} [R=301,L,NE]`;
    })
    .join('\n');

  let config = replaceUniqueMarker(baseTemplate, '# ICONAMASTER_ROUTE_RULES', routeRules);
  config = replaceUniqueMarker(config, '# ICONAMASTER_ALIAS_RULES', aliasRules);
  return config;
}
