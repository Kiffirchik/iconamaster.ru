import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const root = new URL('../../src/', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

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
  assert.match(home, /<IconImage[^>]*mode="full" eager\s*\/>/);
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
  const markup = renderToStaticMarkup(createElement(CollectionPage, { onNavigate() {} }));
  const h1Index = markup.indexOf('<h1');
  const h2Index = markup.indexOf('<h2');
  const h3Index = markup.indexOf('<h3');

  assert.match(
    markup,
    /<section class="collection-page__catalog" aria-labelledby="collection-catalog-title"><h2 id="collection-catalog-title" class="collection-page__catalog-title">Каталог икон<\/h2>/
  );
  assert.ok(h1Index >= 0 && h1Index < h2Index && h2Index < h3Index, 'collection headings must progress h1 → h2 → h3');
});
