import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { navigate, parseRoute } from '../../src/lib/routing.js';

const aliases = JSON.parse(await readFile(new URL('../../public/content/aliases.json', import.meta.url), 'utf8'));

function installBrowserGlobals() {
  const names = ['history', 'window', 'document', 'PopStateEvent'];
  const originals = Object.fromEntries(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  );
  const calls = {
    pushState: [],
    events: [],
    scrollTo: [],
    animationFrames: 0,
    lookups: [],
    scrollIntoView: []
  };
  const element = {
    scrollIntoView(options) {
      calls.scrollIntoView.push(options);
    }
  };

  class TestPopStateEvent {
    constructor(type) {
      this.type = type;
    }
  }

  Object.assign(globalThis, {
    history: {
      pushState(...args) {
        calls.pushState.push(args);
      }
    },
    window: {
      location: { origin: 'https://example.test' },
      dispatchEvent(event) {
        calls.events.push(event.type);
      },
      scrollTo(options) {
        calls.scrollTo.push(options);
      },
      requestAnimationFrame(callback) {
        calls.animationFrames += 1;
        callback();
      }
    },
    document: {
      getElementById(id) {
        calls.lookups.push(id);
        return element;
      }
    },
    PopStateEvent: TestPopStateEvent
  });

  return {
    calls,
    restore() {
      for (const name of names) {
        if (originals[name]) {
          Object.defineProperty(globalThis, name, originals[name]);
        } else {
          delete globalThis[name];
        }
      }
    }
  };
}

test('parseRoute recognizes every canonical route shape', () => {
  const cases = [
    ['/', { name: 'home' }],
    ['/collection/', { name: 'collection' }],
    ['/icons/alexander-peresvet', { name: 'icon', slug: 'alexander-peresvet' }],
    ['/articles', { name: 'articles' }],
    ['/articles/guslitsa', { name: 'article', slug: 'guslitsa' }],
    ['/video', { name: 'video' }],
    ['/contacts', { name: 'contacts' }],
    ['/workshop', { name: 'page', slug: 'workshop', canonicalPath: '/workshop' }],
    ['/excursions', { name: 'page', slug: 'excursions', canonicalPath: '/excursions' }],
    ['/measure-icon', { name: 'page', slug: 'measure-icon', canonicalPath: '/measure-icon' }],
    ['/restoration', { name: 'page', slug: 'restoration', canonicalPath: '/restoration' }],
    ['/kiots', { name: 'page', slug: 'kiots', canonicalPath: '/kiots' }],
    ['/oklads', { name: 'page', slug: 'oklads', canonicalPath: '/oklads' }],
    ['/iconostases', { name: 'page', slug: 'iconostases', canonicalPath: '/iconostases' }]
  ];

  for (const [path, expected] of cases) {
    assert.deepEqual(parseRoute(path, aliases), expected, path);
  }
});

test('parseRoute resolves each supported legacy page alias after trailing-slash normalization', () => {
  const cases = [
    ['/IKONY', { name: 'collection' }],
    ['/IKONY-V-NALICIE', { name: 'collection' }],
    ['/EKSKURSIY-PO-MASTERSKOI', { name: 'page', slug: 'excursions', canonicalPath: '/excursions' }],
    ['/MERNAY-IKONA', { name: 'page', slug: 'measure-icon', canonicalPath: '/measure-icon' }],
    ['/RESTAVRATIY/', { name: 'page', slug: 'restoration', canonicalPath: '/restoration' }],
    ['/KIOTY-I-REZ-BA', { name: 'page', slug: 'kiots', canonicalPath: '/kiots' }],
    ['/OKLADY', { name: 'page', slug: 'oklads', canonicalPath: '/oklads' }],
    ['/IKONOSTASY', { name: 'page', slug: 'iconostases', canonicalPath: '/iconostases' }],
    ['/STAT-I', { name: 'articles' }],
    ['/VIDEO', { name: 'video' }],
    ['/KONTAKTY', { name: 'contacts' }]
  ];

  for (const [path, expected] of cases) {
    assert.deepEqual(parseRoute(path, aliases), expected, path);
  }
});

test('parseRoute rejects unknown paths', () => {
  assert.deepEqual(parseRoute('/missing'), { name: 'not-found' });
});

test('parseRoute rejects malformed percent encoding without throwing', () => {
  for (const path of ['/%', '/%E0%A4%A']) {
    assert.deepEqual(parseRoute(path, aliases), { name: 'not-found' }, path);
  }
});

test('navigate resets to the top for a path without a hash', () => {
  const browser = installBrowserGlobals();

  try {
    navigate('/collection');

    assert.deepEqual(browser.calls.pushState, [[{}, '', '/collection']]);
    assert.deepEqual(browser.calls.events, ['popstate']);
    assert.deepEqual(browser.calls.scrollTo, [{ top: 0, behavior: 'auto' }]);
    assert.equal(browser.calls.animationFrames, 0);
    assert.deepEqual(browser.calls.lookups, []);
  } finally {
    browser.restore();
  }
});

test('navigate scrolls to a hash target without resetting to the top', () => {
  const browser = installBrowserGlobals();

  try {
    navigate('/#contact');

    assert.deepEqual(browser.calls.pushState, [[{}, '', '/#contact']]);
    assert.deepEqual(browser.calls.events, ['popstate']);
    assert.equal(browser.calls.animationFrames, 1);
    assert.deepEqual(browser.calls.lookups, ['contact']);
    assert.deepEqual(browser.calls.scrollIntoView, [{ block: 'start' }]);
    assert.deepEqual(browser.calls.scrollTo, []);
  } finally {
    browser.restore();
  }
});
