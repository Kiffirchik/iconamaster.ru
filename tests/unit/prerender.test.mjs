import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { siteConfig } from '../../src/data/site-config.js';
import {
  buildApacheConfig,
  buildRobots,
  buildSitemap,
  outputPathForRoute,
  renderDocument,
} from '../../scripts/lib/static-site.mjs';

const template = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <title>Иконописная мастерская</title>
    <!-- ICONAMASTER_SEO -->
    <!-- ICONAMASTER_ANALYTICS -->
  </head>
  <body>
    <div id="root"><!-- ICONAMASTER_APP --></div>
    <!-- ICONAMASTER_NOSCRIPT -->
  </body>
</html>`;

const seo = {
  title: 'Икона <Спас> & "оклад"',
  description: 'Описание <опасное> & "точное"',
  canonical: 'https://iconamaster.ru/icons/example?x="<&',
  robots: 'index,follow',
  openGraph: {
    title: 'OG <title>',
    description: 'OG "description" & more',
    url: 'https://iconamaster.ru/icons/example?x="<&',
    type: 'article',
    locale: 'ru_RU',
    image: 'https://iconamaster.ru/image.jpg?x=1&y=2',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Twitter <title>',
    description: 'Twitter "description"',
    image: 'https://iconamaster.ru/image.jpg?x=1&y=2',
  },
  structuredData: {
    '@context': 'https://schema.org',
    name: '</script><script>alert("unsafe")</script>',
  },
};

test('renderDocument emits one safely escaped managed SEO graph and prerendered app', () => {
  const document = renderDocument(template, {
    pathname: '/icons/example',
    appHtml: '<main><h1>Готовая страница</h1></main>',
    seo,
    metrikaId: siteConfig.metrikaId,
  });

  assert.match(document, /<html lang="ru">/u);
  assert.match(document, /<div id="root" data-prerender-path="\/icons\/example"><main><h1>Готовая страница<\/h1><\/main><\/div>/u);
  assert.match(document, /<title data-seo-managed="true">Икона &lt;Спас&gt; &amp; &quot;оклад&quot;<\/title>/u);
  assert.match(document, /content="Описание &lt;опасное&gt; &amp; &quot;точное&quot;"/u);
  assert.match(document, /href="https:\/\/iconamaster\.ru\/icons\/example\?x=&quot;&lt;&amp;"/u);
  assert.equal((document.match(/rel="canonical"/gu) ?? []).length, 1);
  assert.equal((document.match(/type="application\/ld\+json"/gu) ?? []).length, 1);
  assert.equal((document.match(/data-seo-managed="true"/gu) ?? []).length, 15);
  assert.ok(document.includes('\\u003c/script\\u003e\\u003cscript\\u003ealert(\\"unsafe\\")\\u003c/script\\u003e'));
  assert.doesNotMatch(document, /<script>alert\("unsafe"\)<\/script>/u);
});

test('renderDocument inserts exactly one current Metrica initialization and fallback image', () => {
  const document = renderDocument(template, {
    pathname: '/',
    appHtml: '<main><h1>Главная</h1></main>',
    seo,
    metrikaId: siteConfig.metrikaId,
  });

  assert.equal(siteConfig.metrikaId, 112185835);
  assert.equal((document.match(/data-metrika="112185835"/gu) ?? []).length, 1);
  assert.equal((document.match(/ym\(112185835,'init'/gu) ?? []).length, 1);
  assert.equal((document.match(/https:\/\/mc\.yandex\.ru\/watch\/112185835/gu) ?? []).length, 1);
  assert.doesNotMatch(document, /17785549/u);
});

test('renderDocument rejects missing or duplicate injection markers', () => {
  const options = { pathname: '/', appHtml: '<main />', seo, metrikaId: siteConfig.metrikaId };
  assert.throws(() => renderDocument(template.replace('<!-- ICONAMASTER_APP -->', ''), options), /ICONAMASTER_APP/u);
  assert.throws(
    () => renderDocument(template.replace('<!-- ICONAMASTER_SEO -->', '<!-- ICONAMASTER_SEO --><!-- ICONAMASTER_SEO -->'), options),
    /ICONAMASTER_SEO/u,
  );
  assert.throws(
    () => renderDocument(template.replace(
      '<div id="root"><!-- ICONAMASTER_APP --></div>',
      '<div id="root"></div><!-- ICONAMASTER_APP -->',
    ), options),
    /root|ICONAMASTER_APP/u,
  );
});

test('buildSitemap emits canonical URLs without fabricated lastmod metadata', () => {
  const sitemap = buildSitemap(['/collection', '/', '/icons/example'], siteConfig.url);

  assert.equal(sitemap, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://iconamaster.ru/collection</loc></url>
  <url><loc>https://iconamaster.ru/</loc></url>
  <url><loc>https://iconamaster.ru/icons/example</loc></url>
</urlset>
`);
  assert.doesNotMatch(sitemap, /lastmod/u);
});

test('buildRobots points crawlers at the canonical sitemap and excludes Corona', () => {
  assert.equal(buildRobots('https://iconamaster.ru/sitemap.xml'), `User-agent: *
Allow: /
Disallow: /corona/
Disallow: /captcha/
Sitemap: https://iconamaster.ru/sitemap.xml
`);
});

test('outputPathForRoute maps clean routes to contained index files', () => {
  assert.equal(outputPathForRoute('dist/client', '/'), path.join('dist/client', 'index.html'));
  assert.equal(
    outputPathForRoute('dist/client', '/icons/example'),
    path.join('dist/client', 'icons', 'example', 'index.html'),
  );

  for (const unsafePath of ['/../outside', '/icons/%2e%2e/outside', '//outside', '/icons\\outside', '/icons/example/']) {
    assert.throws(() => outputPathForRoute('dist/client', unsafePath), /route|output|path/iu);
  }
});

const apacheTemplate = `DirectoryIndex index.html
ErrorDocument 404 /404.html

RewriteEngine On

# ICONAMASTER_ROUTE_RULES

# ICONAMASTER_ALIAS_RULES

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

RewriteRule ^ - [R=404,L]
`;
const apacheSiteUrl = 'https://iconamaster.ru';

test('buildApacheConfig maps canonical clean paths before the directory guard and returns real 404s', () => {
  const config = buildApacheConfig(apacheTemplate, {
    canonicalPaths: ['/', '/icons/example', '/collection'],
    aliases: {},
    siteUrl: apacheSiteUrl,
  });

  const expectedRoutes = `RewriteRule ^collection/$ https://iconamaster.ru/collection [R=301,L,NE]
RewriteRule ^collection$ collection/index.html [L]
RewriteRule ^icons/example/$ https://iconamaster.ru/icons/example [R=301,L,NE]
RewriteRule ^icons/example$ icons/example/index.html [L]`;
  assert.match(config, new RegExp(expectedRoutes.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  assert.ok(config.indexOf(expectedRoutes) < config.indexOf('RewriteCond %{REQUEST_FILENAME} -d'));
  assert.match(config, /RewriteRule \^ - \[R=404,L\]\s*$/u);
  assert.doesNotMatch(config, /RewriteRule \^ index\.html/u);
});

test('buildApacheConfig emits every external redirect on the canonical HTTPS origin', () => {
  const config = buildApacheConfig(apacheTemplate, {
    canonicalPaths: ['/', '/collection'],
    aliases: { '/legacy-collection': '/collection' },
    siteUrl: 'https://iconamaster.ru',
  });

  assert.match(config, /^RewriteRule \^collection\/\$ https:\/\/iconamaster\.ru\/collection \[R=301,L,NE\]$/m);
  assert.match(config, /^RewriteRule \^legacy-collection\$ https:\/\/iconamaster\.ru\/collection \[R=301,L,NE\]$/m);
});

test('buildApacheConfig rejects a redirect origin that is not a bare HTTPS origin', () => {
  for (const siteUrl of ['http://iconamaster.ru', 'https://iconamaster.ru/path', 'https://user@iconamaster.ru']) {
    assert.throws(
      () => buildApacheConfig(apacheTemplate, {
        canonicalPaths: ['/', '/collection'],
        aliases: {},
        siteUrl,
      }),
      /HTTPS origin/iu,
    );
  }
});

test('buildApacheConfig sorts aliases and escapes their exact source paths', () => {
  const config = buildApacheConfig(apacheTemplate, {
    canonicalPaths: ['/', '/collection', '/icons/example'],
    siteUrl: apacheSiteUrl,
    aliases: {
      '/z.old+(x)': '/icons/example',
      '/a-path': '/collection',
    },
  });

  const first = 'RewriteRule ^a-path$ https://iconamaster.ru/collection [R=301,L,NE]';
  const second = 'RewriteRule ^z\\.old\\+\\(x\\)$ https://iconamaster.ru/icons/example [R=301,L,NE]';
  assert.ok(config.indexOf(first) < config.indexOf(second));
  assert.match(config, new RegExp(second.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
});

test('buildApacheConfig rejects aliases with injection, decoded dot segments, or external targets', () => {
  const unsafeAliases = [
    { '/bad\nRewriteRule ^ https://evil.test': '/collection' },
    { '/safe': '/icons/%2e%2e/collection' },
    { '/safe': 'https://evil.test/collection' },
    { '/safe': '//evil.test/collection' },
    { '/safe': '/not-canonical' },
  ];

  for (const aliases of unsafeAliases) {
    assert.throws(
      () => buildApacheConfig(apacheTemplate, {
        canonicalPaths: ['/', '/collection'],
        aliases,
        siteUrl: apacheSiteUrl,
      }),
      /alias|path|target/iu,
    );
  }
});

test('buildApacheConfig rejects canonical paths that cannot form exact Apache tokens', () => {
  for (const pathname of [
    '/bad path',
    '/bad\tpath',
    '/bad"path',
    '/bad%20path',
    '/bad%09path',
    '/encoded%2Bpath',
  ]) {
    assert.throws(
      () => buildApacheConfig(apacheTemplate, {
        canonicalPaths: ['/', pathname],
        aliases: {},
        siteUrl: apacheSiteUrl,
      }),
      /canonical|path|encoding/iu,
    );
  }
});

test('buildApacheConfig rejects alias paths that cannot form exact Apache tokens', () => {
  for (const source of [
    '/bad path',
    '/bad\tpath',
    '/bad"path',
    '/bad%20path',
    '/bad%09path',
    '/encoded%2Bpath',
  ]) {
    assert.throws(
      () => buildApacheConfig(apacheTemplate, {
        canonicalPaths: ['/', '/collection'],
        aliases: { [source]: '/collection' },
        siteUrl: apacheSiteUrl,
      }),
      /alias|path|encoding/iu,
    );
  }
});
