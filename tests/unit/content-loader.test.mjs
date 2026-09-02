import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createElement } from 'react';
import { act } from 'react';
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

class TestNode {
  constructor(nodeType, ownerDocument = null) {
    this.nodeType = nodeType;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.childNodes = [];
  }

  addEventListener() {}
  removeEventListener() {}

  appendChild(child) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  insertBefore(child, before) {
    child.parentNode = this;
    const index = this.childNodes.indexOf(before);
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, child);
    return child;
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  get firstChild() { return this.childNodes[0] ?? null; }
  get lastChild() { return this.childNodes.at(-1) ?? null; }

  get textContent() { return this.childNodes.map((child) => child.textContent).join(''); }
  set textContent(value) {
    this.childNodes = value ? [this.ownerDocument.createTextNode(value)] : [];
  }
}

class TestElement extends TestNode {
  constructor(tagName, ownerDocument) {
    super(1, ownerDocument);
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.namespaceURI = 'http://www.w3.org/1999/xhtml';
    this.style = {};
    this.attributes = new Map();
  }

  get parentElement() { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
}

class TestText extends TestNode {
  constructor(value, ownerDocument) {
    super(3, ownerDocument);
    this.nodeName = '#text';
    this.nodeValue = String(value);
  }

  get textContent() { return this.nodeValue; }
  set textContent(value) { this.nodeValue = String(value); }
}

class TestDocument extends TestNode {
  constructor() {
    super(9);
    this.ownerDocument = this;
    this.documentElement = new TestElement('html', this);
    this.body = new TestElement('body', this);
    this.documentElement.appendChild(this.body);
    this.activeElement = this.body;
    this.defaultView = null;
  }

  createElement(tagName) { return new TestElement(tagName, this); }
  createTextNode(value) { return new TestText(value, this); }
}

async function mountContentProvider(context, Provider, useContent, props) {
  const documentLike = new TestDocument();
  const windowLike = { document: documentLike, HTMLIFrameElement: class {} };
  documentLike.defaultView = windowLike;
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    navigator: globalThis.navigator,
    actEnvironment: globalThis.IS_REACT_ACT_ENVIRONMENT,
  };
  globalThis.document = documentLike;
  globalThis.window = windowLike;
  globalThis.navigator = { userAgent: 'node.js' };
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  const { createRoot } = await import('react-dom/client');
  const container = documentLike.createElement('div');
  documentLike.body.appendChild(container);
  const root = createRoot(container);
  let content;

  function Probe() {
    content = useContent();
    return null;
  }

  await act(async () => {
    root.render(createElement(Provider, props, createElement(Probe)));
  });

  context.after(async () => {
    await act(async () => root.unmount());
    globalThis.document = previous.document;
    globalThis.window = previous.window;
    globalThis.navigator = previous.navigator;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.actEnvironment;
  });

  return { getContent: () => content };
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

test('ContentProvider exposes an initial bundle as ready during server rendering', async (context) => {
  const { ContentProvider, useContent } = await loadBrowserModule(context, '/src/content/ContentProvider.jsx');
  const initialBundle = { marker: 'server-content' };

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
});

test('client-mounted ContentProvider skips loading when initialized with a bundle', async (context) => {
  const { ContentProvider, useContent } = await loadBrowserModule(context, '/src/content/ContentProvider.jsx');
  const initialBundle = { marker: 'browser-content' };
  let loadCalls = 0;
  const mounted = await mountContentProvider(context, ContentProvider, useContent, {
    initialBundle,
    loadContentImpl: async () => {
      loadCalls += 1;
      return { marker: 'unexpected' };
    },
  });

  assert.equal(mounted.getContent().status, 'ready');
  assert.equal(mounted.getContent().bundle, initialBundle);
  assert.equal(loadCalls, 0);
});

test('client-mounted ContentProvider retries an injected initial error', async (context) => {
  const { ContentProvider, useContent } = await loadBrowserModule(context, '/src/content/ContentProvider.jsx');
  const recoveredBundle = { marker: 'recovered' };
  let loadCalls = 0;
  const mounted = await mountContentProvider(context, ContentProvider, useContent, {
    initialError: new Error('offline'),
    loadContentImpl: async () => {
      loadCalls += 1;
      return recoveredBundle;
    },
  });

  assert.equal(mounted.getContent().status, 'error');
  assert.equal(loadCalls, 0);
  await act(async () => mounted.getContent().retry());
  assert.equal(mounted.getContent().status, 'ready');
  assert.equal(mounted.getContent().bundle, recoveredBundle);
  assert.equal(loadCalls, 1);
});

test('client-mounted ContentProvider retries an error from its first load', async (context) => {
  const { ContentProvider, useContent } = await loadBrowserModule(context, '/src/content/ContentProvider.jsx');
  const recoveredBundle = { marker: 'recovered-later' };
  let loadCalls = 0;
  const mounted = await mountContentProvider(context, ContentProvider, useContent, {
    loadContentImpl: async () => {
      loadCalls += 1;
      if (loadCalls === 1) throw new Error('temporary');
      return recoveredBundle;
    },
  });

  assert.equal(mounted.getContent().status, 'error');
  assert.equal(loadCalls, 1);
  await act(async () => mounted.getContent().retry());
  assert.equal(mounted.getContent().status, 'ready');
  assert.equal(mounted.getContent().bundle, recoveredBundle);
  assert.equal(loadCalls, 2);
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

test('browser bootstrap never hydrates a malformed pathname as the homepage', async (context) => {
  const { bootstrapApp } = await loadBrowserModule(context, '/src/main.jsx');
  const container = { dataset: { prerenderPath: '/' } };
  const calls = [];
  const createRootImpl = () => ({
    render: (tree) => calls.push({ kind: 'create', tree }),
  });

  await bootstrapApp({
    container,
    pathname: '/%',
    loadContentImpl: async () => ({ icons: [], pages: [], articles: [], videos: [], contacts: {}, aliases: {} }),
    hydrateRootImpl: () => calls.push({ kind: 'hydrate' }),
    createRootImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, 'create');
  assert.equal(calls[0].tree.props.children.props.initialPath, '/%');
});
