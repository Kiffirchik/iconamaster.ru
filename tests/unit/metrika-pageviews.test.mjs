import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { renderDocument } from '../../scripts/lib/static-site.mjs';

// Execute the actual generated tracking script; only the external Yandex loader is replaced.
function browser(choice = 'granted') {
  const html = renderDocument('<title>Site</title><!-- ICONAMASTER_SEO --><!-- ICONAMASTER_ANALYTICS --><div id="root"><!-- ICONAMASTER_APP --></div><!-- ICONAMASTER_NOSCRIPT -->', {
    pathname: '/', appHtml: '', metrikaId: 112185835,
    seo: { title: 'Home', canonical: 'https://iconamaster.ru/', openGraph: {}, twitter: {}, structuredData: {} },
  });
  const listeners = new Map();
  const window = { location: { href: 'https://iconamaster.ru/?utm_source=yandex', reload() {} },
    addEventListener: (name, fn) => listeners.set(name, fn) };
  const document = { title: 'Home', referrer: 'https://yandex.ru/', createElement: () => ({}),
    getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }] };
  const context = vm.createContext({ window, document, localStorage: { getItem() {
    if (choice === 'blocked') throw new Error('blocked');
    return choice;
  } } });
  Object.defineProperty(context, 'ym', { get: () => window.ym });
  vm.runInContext(html.match(/<script data-metrika="112185835">([\s\S]*?)<\/script>/u)[1], context);
  const calls = () => Array.from(window.ym?.a ?? [], args => JSON.parse(JSON.stringify(Array.from(args))));
  return { window, calls, consent(value) { listeners.get('iconamaster:analytics-choice')({ detail: value }); },
    page(url, title) { window.location.href = url; document.title = title; listeners.get('iconamaster:pageview')?.({}); },
    hits: () => calls().filter(call => call[1] === 'hit') };
}

test('initial load and SPA navigation each send one pageview with current title and previous URL', () => {
  const b = browser();
  b.page('https://iconamaster.ru/?utm_source=yandex', 'Home'); // hydration must not duplicate init
  b.page('https://iconamaster.ru/icons/venchalnaya-para-vsederzhitel-kazanskaya', 'Wedding pair');
  assert.equal(b.calls()[0][2].defer, true);
  assert.deepEqual(b.hits(), [
    [112185835, 'hit', 'https://iconamaster.ru/?utm_source=yandex', { title: 'Home', referer: 'https://yandex.ru/' }],
    [112185835, 'hit', 'https://iconamaster.ru/icons/venchalnaya-para-vsederzhitel-kazanskaya', { title: 'Wedding pair', referer: 'https://iconamaster.ru/?utm_source=yandex' }],
  ]);
});

test('same-page renders and anchors do not duplicate hits; back and forward do count', () => {
  const b = browser();
  b.page('https://iconamaster.ru/collection', 'Catalog');
  b.page('https://iconamaster.ru/collection#icons', 'Catalog');
  b.page('https://iconamaster.ru/collection#icons', 'Catalog');
  b.page('https://iconamaster.ru/?utm_source=yandex', 'Home');
  b.page('https://iconamaster.ru/collection', 'Catalog');
  assert.deepEqual(b.hits().map(call => call[2]), [
    'https://iconamaster.ru/?utm_source=yandex', 'https://iconamaster.ru/collection',
    'https://iconamaster.ru/?utm_source=yandex', 'https://iconamaster.ru/collection',
  ]);
});

for (const choice of [null, 'denied', 'blocked']) {
  test(`no tracking before consent (${choice}); late consent counts only the current page`, () => {
    const b = browser(choice);
    b.page('https://iconamaster.ru/collection', 'Catalog');
    assert.deepEqual(b.calls(), []);
    b.consent('granted');
    b.consent('granted');
    b.page('https://iconamaster.ru/collection', 'Catalog');
    assert.equal(b.hits().length, 1);
    assert.equal(b.hits()[0][2], 'https://iconamaster.ru/collection');
    b.consent('denied');
    b.page('https://iconamaster.ru/contacts', 'Contacts');
    assert.deepEqual(b.calls(), []);
  });
}
