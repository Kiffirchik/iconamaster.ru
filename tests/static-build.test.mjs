import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { preview } from 'vite';

import { listCanonicalPaths } from '../src/lib/seo.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentRoot = path.join(projectRoot, 'public', 'content');
const clientRoot = path.join(projectRoot, 'dist', 'client');
const siteUrl = 'https://iconamaster.ru';
const metrikaId = '112185835';

async function readBundle() {
  const manifest = JSON.parse(await readFile(path.join(contentRoot, 'manifest.json'), 'utf8'));
  const entries = await Promise.all(Object.entries(manifest.files).map(async ([key, filename]) => [
    key,
    JSON.parse(await readFile(path.join(contentRoot, filename), 'utf8')),
  ]));
  return { version: manifest.version, ...Object.fromEntries(entries) };
}

function outputPathForRoute(pathname) {
  return pathname === '/'
    ? path.join(clientRoot, 'index.html')
    : path.join(clientRoot, pathname.slice(1), 'index.html');
}

function published(records) {
  return (Array.isArray(records) ? records : []).filter((record) => record?.published !== false);
}

function jsonLdDocuments(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*\btype=(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/giu)];
  assert.ok(scripts.length > 0, 'generated page must include JSON-LD');
  return scripts.map(([, , json]) => JSON.parse(json));
}

function canonicalUrl(html) {
  const match = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/u);
  assert.ok(match, 'generated page must include a canonical URL');
  return match[1];
}

function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(([, url]) => url);
}

function assertAliasRedirects(apache, aliases, canonicalPaths) {
  assert.equal(aliases.length, 78, 'current alias bundle must contain 78 redirects');
  const aliasRules = aliases.map(([source, target]) => (
    `RewriteRule ^${source.slice(1)}$ ${siteUrl}${target} [R=301,L,NE]`
  ));
  const canonicalRedirects = new Set(canonicalPaths
    .filter((pathname) => pathname !== '/')
    .map((pathname) => `RewriteRule ^${pathname.slice(1)}/$ ${siteUrl}${pathname} [R=301,L,NE]`));
  const actualAliasRules = apache.split(/\r?\n/u)
    .filter((line) => line.endsWith('[R=301,L,NE]'))
    .filter((line) => !canonicalRedirects.has(line));

  assert.equal(
    actualAliasRules.length,
    78,
    'generated Apache config must contain exactly 78 alias redirects',
  );
  assert.deepEqual(
    new Set(actualAliasRules),
    new Set(aliasRules),
    'generated Apache config must not contain unexpected alias redirects',
  );
}

test('static alias gate rejects an unexpected alias redirect', async () => {
  const bundle = await readBundle();
  const apache = await readFile(path.join(clientRoot, '.htaccess'), 'utf8');
  const unexpectedAlias = `RewriteRule ^unexpected-alias$ ${siteUrl}/collection [R=301,L,NE]`;

  assert.throws(
    () => assertAliasRedirects(
      `${apache}\n${unexpectedAlias}`,
      Object.entries(bundle.aliases),
      listCanonicalPaths(bundle),
    ),
    /exactly 78 alias redirects/u,
  );
});

test('preview serves a canonical clean path from its prerendered route document', async (context) => {
  const server = await preview({
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: 0 },
  });
  context.after(() => server.close());

  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string', 'preview must listen on a TCP port');
  const response = await fetch(`http://127.0.0.1:${address.port}/raschistka-hramovyh-rospisey`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<title data-seo-managed="true">Расчистка настенных храмовых росписей/u);
  assert.match(html, /data-prerender-path="\/raschistka-hramovyh-rospisey"/u);
});

test('preview does not reject a malformed percent-encoded path', async (context) => {
  const server = await preview({
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: 0 },
  });
  context.after(() => server.close());

  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string', 'preview must listen on a TCP port');
  const response = await fetch(`http://127.0.0.1:${address.port}/%E0%A4%A`);

  assert.equal(response.status, 400, 'malformed paths must get a controlled preview response');
  assert.equal(await response.text(), 'Bad Request');
});

test('preview can inject local contact-goal instrumentation without changing contact destinations', async (context) => {
  const server = await preview({
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: 0 },
  });
  context.after(() => server.close());

  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string', 'preview must listen on a TCP port');
  const response = await fetch(`http://127.0.0.1:${address.port}/contacts?__qa_contact_instrument=1`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /<script data-qa-contact-instrument>/u);
  assert.match(html, /href="https:\/\/wa\.me\/79166554595"/u);
  assert.match(html, /href="tel:\+79166554595"/u);
  assert.match(html, /href="mailto:iconamaster@yandex\.ru"/u);
});

test('preview contact instrumentation records a goal and safely intercepts its destination', async (context) => {
  const server = await preview({
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: 0 },
  });
  context.after(() => server.close());

  const address = server.httpServer.address();
  assert.ok(address && typeof address !== 'string', 'preview must listen on a TCP port');
  const html = await (await fetch(`http://127.0.0.1:${address.port}/contacts?__qa_contact_instrument=1`)).text();
  const script = html.match(/<script data-qa-contact-instrument>([\s\S]*?)<\/script>/u)?.[1];
  assert.ok(script, 'preview must emit the local contact instrumentation');

  let clickListener;
  const document = { documentElement: { dataset: {} } };
  const window = {
    addEventListener(type, listener, capture) {
      if (type === 'click' && capture === true) clickListener = listener;
    },
  };
  class Anchor {
    constructor(href, target = '') {
      this.href = href;
      this.target = target;
      const url = new URL(href, 'https://preview.test');
      this.protocol = url.protocol;
      this.hostname = url.hostname;
    }

    closest(selector) {
      return selector === 'a' ? this : null;
    }
  }

  runInNewContext(script, { document, Element: Anchor, window });
  assert.equal(typeof clickListener, 'function');
  const event = {
    target: new Anchor('tel:+79166554595'),
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
  };
  clickListener(event);
  window.ym(112185835, 'reachGoal', 'contact_phone');

  assert.deepEqual(JSON.parse(document.documentElement.dataset.qaContactEvents), [
    { kind: 'contact-click', href: 'tel:+79166554595', target: null, defaultPreventedBefore: false },
    { kind: 'contact-navigation-intercepted', href: 'tel:+79166554595', target: null, defaultPreventedAfter: true },
    { kind: 'ym', args: [112185835, 'reachGoal', 'contact_phone'] },
  ]);
});

test('static build publishes every canonical page with crawlable Russian SEO metadata', async () => {
  const bundle = await readBundle();
  const canonicalPaths = listCanonicalPaths(bundle);
  const publishedIcons = published(bundle.icons);
  const publishedPages = published(bundle.pages);
  const publishedArticles = published(bundle.articles);
  const hasVideo = published(bundle.videos).length > 0;
  const hasContacts = Boolean(bundle.contacts);
  const expectedRouteCount = 2
    + publishedIcons.length
    + publishedPages.length
    + 1
    + publishedArticles.length
    + Number(hasVideo)
    + Number(hasContacts);

  assert.equal(publishedIcons.length, 50, 'current bundle must publish 50 icon pages');
  assert.equal(publishedPages.length, 8, 'current bundle must publish 8 standard pages');
  assert.equal(publishedArticles.length, 10, 'current bundle must publish 10 article pages');
  assert.equal(hasVideo, true, 'current bundle must publish its video page');
  assert.equal(hasContacts, true, 'current bundle must publish its contacts page');
  assert.equal(expectedRouteCount, canonicalPaths.length, 'canonical paths must derive from published bundle records');
  assert.equal(canonicalPaths.length, 73, 'current bundle must publish 73 canonical routes');

  const canonicalUrls = [];
  for (const pathname of canonicalPaths) {
    const html = await readFile(outputPathForRoute(pathname), 'utf8');
    assert.match(html, /<html\s+lang="ru">/u);
    assert.match(html, /<h1\b/u);
    assert.match(html, /<meta\s+name="description"/u);
    assert.match(html, /<link\s+rel="canonical"/u);
    assert.match(html, /property="og:title"/u);
    assert.match(html, /type="application\/ld\+json"/u);
    assert.match(html, /data-prerender-path=/u);
    assert.doesNotMatch(html, /Prototype/u);
    assert.doesNotMatch(html, /Загружаем коллекцию/u);
    assert.match(html, new RegExp(`data-metrika="${metrikaId}"`, 'u'));
    jsonLdDocuments(html);

    const url = canonicalUrl(html);
    assert.equal(url, new URL(pathname, `${siteUrl}/`).href);
    canonicalUrls.push(url);
  }

  assert.equal(new Set(canonicalUrls).size, 73, 'canonical pages must emit 73 unique canonical URLs');

  const sitemap = await readFile(path.join(clientRoot, 'sitemap.xml'), 'utf8');
  const urls = sitemapUrls(sitemap);
  assert.equal(urls.length, 73, 'sitemap must contain every canonical URL exactly once');
  assert.deepEqual(new Set(urls), new Set(canonicalUrls));
  for (const alias of Object.keys(bundle.aliases)) {
    assert.ok(!urls.includes(new URL(alias, `${siteUrl}/`).href), `sitemap must not include alias ${alias}`);
  }

  const apache = await readFile(path.join(clientRoot, '.htaccess'), 'utf8');
  const aliases = Object.entries(bundle.aliases);
  assertAliasRedirects(apache, aliases, canonicalPaths);

  const notFound = await readFile(path.join(clientRoot, '404.html'), 'utf8');
  assert.match(notFound, /<meta\s+name="robots"\s+content="noindex,follow"/u);
  assert.doesNotMatch(notFound, /Prototype/u);
});
