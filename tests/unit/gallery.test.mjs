import assert from 'node:assert/strict';
import test from 'node:test';
import { clampGalleryIndex } from '../../src/lib/gallery.js';

test('clampGalleryIndex resets a retained gallery index for a one-image icon', () => {
  assert.equal(clampGalleryIndex(4, 1), 0);
});

test('clampGalleryIndex preserves a valid gallery index', () => {
  assert.equal(clampGalleryIndex(4, 5), 4);
});
