import assert from 'node:assert/strict';
import test from 'node:test';
import { publishedIcons, validateContentBundle } from '../../src/content/schema.js';

const validImage = {
  src: '/assets/icons/example.jpg',
  alt: 'Икона, полный вид',
  width: 1200,
  height: 1600,
  fit: 'contain',
  position: '50% 50%'
};

const validBundle = {
  version: 1,
  icons: [{
    id: 'icon-1', slug: 'example', title: 'Пример', published: true,
    availability: 'В наличии', price: null, order: 10,
    type: 'Авторские', period: 'Современные', size: '', technique: '',
    origin: '', condition: '', expertise: '', description: '',
    sourceUrl: 'https://iconamaster.ru/example/', images: [validImage]
  }],
  pages: [], articles: [], videos: [], contacts: {
    whatsapp: '79166554595', phone: '+79166554595', email: 'iconamaster@yandex.ru'
  }, aliases: {}
};

test('validates the canonical content bundle', () => {
  assert.deepEqual(validateContentBundle(validBundle), { ok: true, errors: [] });
});

test('rejects a published icon without an image', () => {
  const bundle = structuredClone(validBundle);
  bundle.icons[0].images = [];
  assert.match(validateContentBundle(bundle).errors.join('\n'), /published icon example has no images/);
});

test('returns validation errors for a non-array icons collection', () => {
  const bundle = structuredClone(validBundle);
  bundle.icons = {};
  assert.deepEqual(validateContentBundle(bundle), {
    ok: false,
    errors: ['icons must be an array']
  });
});

test('publishedIcons returns an empty array for missing or non-array icons', () => {
  assert.deepEqual(publishedIcons(), []);
  assert.deepEqual(publishedIcons({ icons: {} }), []);
});

test('publishedIcons sorts records and excludes unpublished records', () => {
  const bundle = structuredClone(validBundle);
  bundle.icons.push(
    { ...bundle.icons[0], id: 'icon-2', slug: 'later', order: 30 },
    { ...bundle.icons[0], id: 'icon-3', slug: 'earlier', order: 5 },
    { ...bundle.icons[0], id: 'icon-4', slug: 'hidden', published: false, order: 1 }
  );
  assert.deepEqual(publishedIcons(bundle).map(({ slug }) => slug), ['earlier', 'example', 'later']);
});
