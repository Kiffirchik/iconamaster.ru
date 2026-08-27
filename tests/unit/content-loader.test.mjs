import assert from 'node:assert/strict';
import test from 'node:test';
import { loadContent } from '../../src/content/load-content.js';

test('loads every document named by the manifest', async () => {
  const responses = new Map([
    ['/content/manifest.json', { version: 1, files: {
      icons: 'icons.json', pages: 'pages.json', articles: 'articles.json',
      videos: 'videos.json', contacts: 'contacts.json', aliases: 'aliases.json'
    }}],
    ['/content/icons.json', []], ['/content/pages.json', []],
    ['/content/articles.json', []], ['/content/videos.json', []],
    ['/content/contacts.json', { whatsapp: '79166554595', phone: '+79166554595', email: 'iconamaster@yandex.ru' }],
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
