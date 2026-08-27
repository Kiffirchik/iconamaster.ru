import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const stylesheet = await readFile(new URL('../../src/styles.css', import.meta.url), 'utf8');
const header = await readFile(new URL('../../src/components/SiteHeader.jsx', import.meta.url), 'utf8');
const mobileStyles = stylesheet.slice(
  stylesheet.indexOf('@media (max-width: 760px)'),
  stylesheet.indexOf('@media (prefers-reduced-motion: reduce)')
);

async function loadHeader(context) {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true }
  });
  context.after(() => server.close());
  return server.ssrLoadModule('/src/components/SiteHeader.jsx');
}

test('header renders canonical same-tab links and a native workshop disclosure', async (context) => {
  const { SiteHeader } = await loadHeader(context);
  const markup = renderToStaticMarkup(createElement(SiteHeader, { onNavigate() {} }));
  const navigationMarkup = markup.match(/<nav id="site-navigation"[\s\S]*<\/nav>/)?.[0] ?? '';

  const topLinks = [...navigationMarkup.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map(([, href, label]) => [label, href])
    .filter(([, href]) => ['/', '/collection', '/restoration', '/articles', '/video', '/contacts'].includes(href));

  assert.deepEqual(topLinks, [
    ['Главная', '/'],
    ['Иконы в наличии', '/collection'],
    ['Реставрация', '/restoration'],
    ['Статьи', '/articles'],
    ['Видео', '/video'],
    ['Контакты', '/contacts']
  ]);
  assert.match(navigationMarkup, /<details[^>]*class="site-header__workshop"[^>]*><summary>Мастерская<\/summary>/);
  for (const [label, path] of [
    ['Экскурсии по мастерской', '/excursions'],
    ['Мерная икона', '/measure-icon'],
    ['Киоты и резьба', '/kiots'],
    ['Оклады на иконы', '/oklads'],
    ['Иконостасы', '/iconostases']
  ]) {
    assert.match(navigationMarkup, new RegExp(`href="${path}"[^>]*>${label}<\\/a>`));
  }
  assert.doesNotMatch(navigationMarkup, /target=/);
});

test('mobile navigation expands in normal document flow', () => {
  assert.match(
    mobileStyles,
    /\.site-header__inner\s*\{[^}]*flex-wrap:\s*wrap;/s,
    'the mobile header must wrap so the open navigation reserves vertical space'
  );
  assert.match(
    mobileStyles,
    /\.site-header__nav\s*\{[^}]*position:\s*static;/s,
    'the mobile navigation must remain in normal document flow'
  );
  assert.match(
    mobileStyles,
    /\.site-header__workshop-links\s*\{[^}]*position:\s*static;/s,
    'the mobile workshop disclosure must remain in normal document flow'
  );
});

test('the shell and mobile navigation cannot widen 360px or 390px viewports', () => {
  assert.match(stylesheet, /\.site-shell\s*\{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*clip;/s);
  assert.match(mobileStyles, /\.site-header__nav\s*\{[^}]*min-width:\s*0;[^}]*width:\s*100%;/s);
  assert.match(mobileStyles, /\.site-header__workshop\s*\{[^}]*min-width:\s*0;[^}]*width:\s*100%;/s);
  assert.match(mobileStyles, /\.site-header__workshop-links a\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
});

test('header uses a normal-flow compact menu throughout the tablet overflow range', () => {
  const edgeStart = stylesheet.indexOf('@media (min-width: 761px) and (max-width: 1008px)');
  const edgeEnd = stylesheet.indexOf('@media (max-width: 760px)', edgeStart);

  assert.notEqual(edgeStart, -1, 'the edge-width header breakpoint must begin at 761px');
  assert.notEqual(edgeEnd, -1, 'the edge-width header breakpoint must end before the existing mobile rules');

  const edgeStyles = stylesheet.slice(edgeStart, edgeEnd);
  assert.match(edgeStyles, /\.site-header__inner\s*\{[^}]*flex-wrap:\s*wrap;/s);
  assert.match(edgeStyles, /\.site-header__menu-button\s*\{[^}]*display:\s*inline-flex;/s);
  assert.match(edgeStyles, /\.site-header__nav\s*\{[^}]*display:\s*none;[^}]*position:\s*static;/s);
  assert.match(edgeStyles, /\.site-header__nav\.is-open\s*\{[^}]*display:\s*grid;/s);
  assert.match(edgeStyles, /\.site-header__nav a\s*\{[^}]*min-height:\s*2\.75rem;/s);
  assert.match(header, /matchMedia\('\(min-width: 1009px\)'\)/);
});
