import assert from 'node:assert/strict';
import test from 'node:test';
import { navigate, parseRoute } from '../../src/lib/routing.js';

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

test('parseRoute recognizes the three prototype route shapes', () => {
  assert.deepEqual(parseRoute('/'), { name: 'home' });
  assert.deepEqual(parseRoute('/collection'), { name: 'collection' });
  assert.deepEqual(parseRoute('/icons/alexander-peresvet'), {
    name: 'icon',
    slug: 'alexander-peresvet'
  });
});

test('parseRoute removes one trailing slash and rejects unknown paths', () => {
  assert.deepEqual(parseRoute('/collection/'), { name: 'collection' });
  assert.deepEqual(parseRoute('/missing'), { name: 'not-found' });
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
