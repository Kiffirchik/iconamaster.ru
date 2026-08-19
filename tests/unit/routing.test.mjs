import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRoute } from '../../src/lib/routing.js';

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
