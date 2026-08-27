import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const stylesheet = await readFile(new URL('../../src/styles.css', import.meta.url), 'utf8');
const mobileStyles = stylesheet.slice(
  stylesheet.indexOf('@media (max-width: 760px)'),
  stylesheet.indexOf('@media (prefers-reduced-motion: reduce)')
);

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
  assert.equal(declarationsFor(mobileStyles, '.site-header__inner')['flex-wrap'], 'wrap');
  assert.equal(declarationsFor(mobileStyles, '.site-header__nav').position, 'static');
  assert.equal(declarationsFor(mobileStyles, '.site-header__workshop-links').position, 'static');
});

test('the shell and mobile navigation cannot widen 360px or 390px viewports', () => {
  const shell = declarationsFor(stylesheet, '.site-shell');
  const nav = declarationsFor(mobileStyles, '.site-header__nav');
  const workshop = declarationsFor(mobileStyles, '.site-header__workshop');
  const workshopLink = declarationsFor(mobileStyles, '.site-header__workshop-links a');
  assert.deepEqual(
    { maxWidth: shell['max-width'], overflowX: shell['overflow-x'] },
    { maxWidth: '100%', overflowX: 'clip' }
  );
  assert.deepEqual({ minWidth: nav['min-width'], width: nav.width }, { minWidth: '0', width: '100%' });
  assert.deepEqual({ minWidth: workshop['min-width'], width: workshop.width }, { minWidth: '0', width: '100%' });
  assert.equal(workshopLink['overflow-wrap'], 'anywhere');
});

test('header uses a normal-flow compact menu throughout the tablet overflow range', () => {
  const edgeStart = stylesheet.indexOf('@media (min-width: 761px) and (max-width: 1008px)');
  const edgeEnd = stylesheet.indexOf('@media (max-width: 760px)', edgeStart);

  assert.notEqual(edgeStart, -1, 'the edge-width header breakpoint must begin at 761px');
  assert.notEqual(edgeEnd, -1, 'the edge-width header breakpoint must end before the existing mobile rules');

  const edgeStyles = stylesheet.slice(edgeStart, edgeEnd);
  assert.equal(declarationsFor(edgeStyles, '.site-header__inner')['flex-wrap'], 'wrap');
  assert.equal(declarationsFor(edgeStyles, '.site-header__menu-button').display, 'inline-flex');
  const nav = declarationsFor(edgeStyles, '.site-header__nav');
  assert.deepEqual({ display: nav.display, position: nav.position }, { display: 'none', position: 'static' });
  assert.equal(declarationsFor(edgeStyles, '.site-header__nav.is-open').display, 'grid');
  assert.equal(declarationsFor(edgeStyles, '.site-header__nav a')['min-height'], '2.75rem');
});
