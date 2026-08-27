import assert from 'node:assert/strict';
import test from 'node:test';
import { renderableSections, selectBySlug } from '../../src/lib/content-selectors.js';

test('removes a missing image block without leaving a layout slot', () => {
  const sections = [
    { type: 'image', image: null },
    { type: 'text', heading: 'Реставрация', paragraphs: ['Текст'] }
  ];

  assert.deepEqual(renderableSections(sections), [sections[1]]);
});

test('removes galleries without any usable image source', () => {
  const sections = [
    { type: 'gallery', images: [{ src: '' }, null] },
    { type: 'gallery', images: [{ src: '/assets/pages/restoration.jpg' }] }
  ];

  assert.deepEqual(renderableSections(sections), [sections[1]]);
});

test('keeps only supported section types with visible content', () => {
  const sections = [
    { type: 'html', value: '<script>alert(1)</script>' },
    { type: 'text', heading: '', paragraphs: [] },
    { type: 'text', heading: 'Мастерская', paragraphs: [] }
  ];

  assert.deepEqual(renderableSections(sections), [sections[2]]);
});

test('selectBySlug returns null for an unpublished article', () => {
  assert.equal(selectBySlug([{ slug: 'hidden', published: false }], 'hidden'), null);
});

test('selectBySlug returns a published item and tolerates a missing collection', () => {
  const article = { slug: 'guslitsa', published: true };

  assert.equal(selectBySlug([article], 'guslitsa'), article);
  assert.equal(selectBySlug(undefined, 'guslitsa'), null);
});
