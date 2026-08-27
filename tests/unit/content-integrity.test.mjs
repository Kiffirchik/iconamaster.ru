import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  verifyContent,
  verifyOwnedAssetInventory,
  verifyProject,
} from '../../scripts/verify-content.mjs';
import { verifyIconAssetSet } from '../../scripts/verify-icon-assets.mjs';

const canonicalContacts = {
  whatsapp: '79166554595',
  phone: '+79166554595',
  email: 'iconamaster@yandex.ru',
  sourceUrl: 'https://iconamaster.cargo.site/KONTAKTY',
};

const validImage = {
  src: '/assets/pages/example.jpg',
  alt: 'Икона, полный вид',
  width: 1200,
  height: 1600,
};

const bundle = (overrides = {}) => ({
  version: 1,
  icons: [],
  pages: [],
  articles: [],
  videos: [],
  contacts: canonicalContacts,
  aliases: {},
  ...overrides,
});

test('integrity validator reports a missing asset and empty image block', () => {
  const errors = verifyContent({
    version: 1,
    icons: [{
      slug: 'broken',
      published: true,
      images: [{
        src: '/assets/icons/missing.jpg',
        alt: 'Икона',
        width: 1200,
        height: 1600,
      }],
    }],
    pages: [{ slug: 'page', sections: [{ type: 'image', image: null }] }],
    articles: [],
    videos: [],
    contacts: canonicalContacts,
    aliases: {},
  }, new Set());

  assert.deepEqual(errors, [
    'published icon broken references missing /assets/icons/missing.jpg',
    'page page contains an empty image block',
  ]);
});

test('integrity validator rejects duplicate slugs and unusable published icon images', () => {
  const errors = verifyContent(bundle({
    icons: [
      {
        slug: 'duplicate',
        published: true,
        images: [{ ...validImage, src: 'https://example.test/icon.jpg' }],
      },
      {
        slug: 'duplicate',
        published: true,
        images: [{ ...validImage, alt: '  ', width: 0, height: 1.5 }],
      },
    ],
    pages: [
      { slug: 'unsafe', sections: [{ type: 'image', image: { ...validImage, src: '/assets/pages/%2e%2e/private.jpg' } }] },
      { slug: 'external', sections: [{ type: 'image', image: { ...validImage, src: '//cdn.example.test/image.jpg' } }] },
    ],
  }), new Set(['/assets/pages/example.jpg']));

  assert.ok(errors.includes('duplicate icon slug duplicate'));
  assert.ok(errors.includes('published icon duplicate has no usable images'));
  assert.ok(errors.includes('icon duplicate image 1 has invalid asset path https://example.test/icon.jpg'));
  assert.ok(errors.includes('icon duplicate image 1 requires non-empty alt text'));
  assert.ok(errors.includes('icon duplicate image 1 has invalid dimensions 0x1.5'));
  assert.ok(errors.includes('page unsafe image block has invalid asset path /assets/pages/%2e%2e/private.jpg'));
  assert.ok(errors.includes('page external image block has invalid asset path //cdn.example.test/image.jpg'));
});

test('integrity validator recursively rejects empty blocks, autoplay, and raw executable HTML', () => {
  const errors = verifyContent(bundle({
    pages: [{
      slug: 'nested',
      sections: [{
        type: 'text',
        heading: 'Безопасный заголовок',
        paragraphs: ['Абзац'],
        children: [
          { type: 'text', heading: ' ', paragraphs: [] },
          { type: 'gallery', images: [] },
          { type: 'unsupported', value: '<script>alert(1)</script>' },
          { type: 'image', image: validImage, autoplay: true },
        ],
      }],
    }],
  }), new Set([validImage.src]));

  assert.ok(errors.includes('page nested contains an empty text block'));
  assert.ok(errors.includes('page nested contains an empty gallery block'));
  assert.ok(errors.includes('page nested contains unsupported block type unsupported'));
  assert.ok(errors.includes('page nested contains raw executable HTML'));
  assert.ok(errors.includes('page nested enables autoplay'));
});

test('integrity validator requires direct recognized root-relative aliases and reports loops', () => {
  const errors = verifyContent(bundle({
    icons: [{ slug: 'known-icon', published: false, images: [] }],
    pages: [{ slug: 'workshop', sections: [{ type: 'text', paragraphs: ['Текст'] }] }],
    articles: [{ slug: 'known-article', sections: [{ type: 'text', paragraphs: ['Текст'] }] }],
    aliases: {
      '/good-icon': '/icons/known-icon',
      '/missing-icon': '/icons/missing',
      '/unknown': '/nowhere',
      '/external': 'https://example.test/collection',
      '/loop-a': '/loop-b',
      '/loop-b': '/loop-a',
    },
  }), new Set());

  assert.ok(!errors.some((error) => error.includes('/good-icon')));
  assert.ok(errors.includes('alias /missing-icon targets missing icon missing'));
  assert.ok(errors.includes('alias /unknown has unrecognized target /nowhere'));
  assert.ok(errors.includes('alias /external target must be root-relative: https://example.test/collection'));
  assert.ok(errors.includes('alias loop detected: /loop-a -> /loop-b -> /loop-a'));
});

test('integrity validator enforces canonical contacts and exact source-map contracts', () => {
  const errors = verifyContent(bundle({
    contacts: {
      whatsapp: '+7 916 655-45-95',
      phone: '8 916 655-45-95',
      email: 'sales@example.test',
    },
    icons: [{ slug: 'unexpected', published: false, images: [] }],
  }), new Set(), {
    expected: {
      icons: ['expected'],
      pages: [],
      articles: [],
      videos: ['youtube:y10sw1KIOqQ', 'vimeo:353365425'],
      excludedAliases: ['/excluded-article'],
    },
  });

  assert.ok(errors.includes('contacts.whatsapp must be 79166554595'));
  assert.ok(errors.includes('contacts.phone must be +79166554595'));
  assert.ok(errors.includes('contacts.email must be iconamaster@yandex.ru'));
  assert.ok(errors.includes('icons contract is missing slug expected'));
  assert.ok(errors.includes('icons contract has unexpected slug unexpected'));
  assert.ok(errors.includes('videos contract is missing youtube:y10sw1KIOqQ'));
  assert.ok(errors.includes('videos contract is missing vimeo:353365425'));
});

test('owned asset inventory reports missing, stale, unreferenced, and undeclared files', () => {
  const errors = verifyOwnedAssetInventory({
    diskFiles: new Set([
      '/assets/icons/kept.jpg',
      '/assets/icons/stale.jpg',
      '/assets/icons/unreferenced.jpg',
      '/assets/pages/undeclared.jpg',
    ]),
    referencedFiles: new Set([
      '/assets/icons/kept.jpg',
      '/assets/pages/undeclared.jpg',
      '/assets/articles/missing.jpg',
    ]),
    ownedFiles: new Set([
      '/assets/icons/kept.jpg',
      '/assets/icons/unreferenced.jpg',
      '/assets/articles/missing.jpg',
    ]),
  });

  assert.deepEqual(errors, [
    'owned asset is missing from disk: /assets/articles/missing.jpg',
    'owned asset is unreferenced: /assets/icons/unreferenced.jpg',
    'stale asset file is not owned: /assets/icons/stale.jpg',
    'referenced asset is not in the ownership inventory: /assets/pages/undeclared.jpg',
  ]);
});

test('clean checkout content, aliases, ownership inventories, and local assets pass together', async () => {
  const result = await verifyProject(new URL('../../', import.meta.url));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.summary, {
    icons: 50,
    publishedIcons: 50,
    pages: 7,
    articles: 8,
    videos: 2,
    aliases: 78,
    referencedAssets: 258,
    ownedAssets: 258,
  });
});

test('icon asset verifier streams hashes and rejects missing, stale, and unowned originals', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'iconamaster-icon-gate-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const goodBytes = Buffer.from('immutable original');
  const rogueBytes = Buffer.from('unowned original');
  await Promise.all([
    writeFile(path.join(directory, 'good.jpg'), goodBytes),
    writeFile(path.join(directory, 'rogue.jpg'), rogueBytes),
    writeFile(path.join(directory, 'stale.jpg'), Buffer.from('stale')),
  ]);

  const errors = await verifyIconAssetSet({
    assetDirectory: directory,
    manifest: [
      {
        file: 'good.jpg',
        bytes: goodBytes.length,
        sha256: createHash('sha256').update(goodBytes).digest('hex'),
        width: 10,
        height: 20,
        sourceUrl: 'https://freight.cargo.site/t/original/good.jpg',
        legacyPath: '/GOOD',
        role: 'original',
        provenance: 'fixture-original',
      },
      {
        file: 'missing.jpg',
        bytes: 1,
        sha256: '0'.repeat(64),
        width: 10,
        height: 20,
        sourceUrl: 'https://freight.cargo.site/t/original/missing.jpg',
        legacyPath: '/MISSING',
        role: 'original',
        provenance: 'fixture-original',
      },
      {
        file: 'rogue.jpg',
        bytes: rogueBytes.length,
        sha256: createHash('sha256').update(rogueBytes).digest('hex'),
        width: 10,
        height: 20,
        sourceUrl: 'https://freight.cargo.site/t/original/rogue.jpg',
        legacyPath: '/ROGUE',
        role: 'original',
        provenance: 'fixture-original',
      },
    ],
    allowedOwners: new Map([
      ['https://freight.cargo.site/t/original/good.jpg', '/GOOD'],
      ['https://freight.cargo.site/t/original/missing.jpg', '/MISSING'],
    ]),
  });

  assert.deepEqual(errors, [
    'original asset is missing: missing.jpg',
    'manifest source has no independent owner: https://freight.cargo.site/t/original/rogue.jpg',
    'stale icon asset file is not in the manifest: stale.jpg',
  ]);
});
