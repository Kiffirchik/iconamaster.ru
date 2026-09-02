import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import { loadContent } from '../../src/content/load-content.js';

async function loadBrowserModule(context, path) {
  const server = await createServer({
    appType: 'custom',
    logLevel: 'silent',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    server: { middlewareMode: true },
  });
  context.after(() => server.close());
  return server.ssrLoadModule(path);
}

test('loads every document named by the manifest', async () => {
  const responses = new Map([
    ['/content/manifest.json', { version: 1, files: {
      icons: 'icons.json', pages: 'pages.json', articles: 'articles.json',
      videos: 'videos.json', contacts: 'contacts.json', aliases: 'aliases.json'
    }}],
    ['/content/icons.json', []], ['/content/pages.json', []],
    ['/content/articles.json', []], ['/content/videos.json', []],
    ['/content/contacts.json', {
      whatsapp: '79166554595',
      phone: '+79166554595',
      email: 'iconamaster@yandex.ru',
      mapUrl: 'https://yandex.com/maps/-/CTT2bAoq',
      address: {
        display: 'Московская область, д. Брёхово, Ромашковая ул., 16',
        streetAddress: 'Ромашковая ул., 16',
        addressLocality: 'д. Брёхово',
        addressRegion: 'Московская область',
        addressCountry: 'RU',
      },
    }],
    ['/content/aliases.json', {}]
  ]);
  const bundle = await loadContent(async (url) => ({
    ok: responses.has(url), json: async () => responses.get(url)
  }));
  assert.equal(bundle.version, 1);
  assert.deepEqual(bundle.icons, []);
});

test('reports the exact failed content URL', async () => {
  await assert.rejects(
    loadContent(async () => ({ ok: false, status: 503 })),
    /failed to load \/content\/manifest.json: 503/
  );
});

test('ContentProvider exposes an initial bundle as ready without fetching', async (context) => {
  const { ContentProvider, useContent } = await loadBrowserModule(context, '/src/content/ContentProvider.jsx');
  const initialBundle = { marker: 'server-content' };
  let fetchCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('unexpected fetch');
  };
  context.after(() => { globalThis.fetch = previousFetch; });

  function Probe() {
    const content = useContent();
    return createElement('output', {
      'data-status': content.status,
      'data-marker': content.bundle?.marker,
    });
  }

  const html = renderToString(createElement(
    ContentProvider,
    { initialBundle },
    createElement(Probe),
  ));

  assert.match(html, /data-status="ready"/u);
  assert.match(html, /data-marker="server-content"/u);
  assert.equal(fetchCalls, 0);
});

test('browser bootstrap preserves prerendered content until matching hydration is ready', async (context) => {
  const { bootstrapApp } = await loadBrowserModule(context, '/src/main.jsx');
  let resolveContent;
  const content = new Promise((resolve) => { resolveContent = resolve; });
  const container = {
    dataset: { prerenderPath: '/contacts' },
    innerHTML: '<main>Предварительно отрисованные контакты</main>',
  };
  const calls = [];

  const boot = bootstrapApp({
    container,
    pathname: '/contacts/',
    loadContentImpl: () => content,
    hydrateRootImpl: (...args) => calls.push(['hydrate', ...args]),
    createRootImpl: (...args) => calls.push(['create', ...args]),
  });

  await Promise.resolve();
  assert.equal(container.innerHTML, '<main>Предварительно отрисованные контакты</main>');
  assert.deepEqual(calls, []);

  resolveContent({ icons: [], pages: [], articles: [], videos: [], contacts: {}, aliases: {} });
  await boot;
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'hydrate');
  assert.equal(calls[0][1], container);
});

test('browser bootstrap uses a clean render for a different path and for load errors', async (context) => {
  const { bootstrapApp } = await loadBrowserModule(context, '/src/main.jsx');
  const readyContainer = { dataset: { prerenderPath: '/collection' } };
  const errorContainer = { dataset: { prerenderPath: '/contacts' } };
  const calls = [];
  const createRootImpl = (container) => ({
    render: (tree) => calls.push({ container, tree }),
  });

  await bootstrapApp({
    container: readyContainer,
    pathname: '/contacts',
    loadContentImpl: async () => ({ icons: [], pages: [], articles: [], videos: [], contacts: {}, aliases: {} }),
    hydrateRootImpl: () => assert.fail('must not hydrate a different route'),
    createRootImpl,
  });
  await bootstrapApp({
    container: errorContainer,
    pathname: '/contacts',
    loadContentImpl: async () => { throw new Error('offline'); },
    hydrateRootImpl: () => assert.fail('must not hydrate an error state'),
    createRootImpl,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].container, readyContainer);
  assert.equal(calls[0].tree.props.children.props.initialPath, '/contacts');
  assert.equal(calls[0].tree.props.children.props.initialBundle.contacts !== undefined, true);
  assert.equal(calls[1].container, errorContainer);
  assert.equal(calls[1].tree.props.children.props.initialPath, '/contacts');
  assert.equal(calls[1].tree.props.children.props.initialError.message, 'offline');
});
