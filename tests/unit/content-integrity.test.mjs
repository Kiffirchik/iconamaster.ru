import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  inspectContentDirectory,
  verifyContent,
  verifyEditorialAssetFiles,
  verifyOwnedAssetInventory,
  verifyProject,
} from '../../scripts/verify-content.mjs';
import { verifyIconAssetProject, verifyIconAssetSet } from '../../scripts/verify-icon-assets.mjs';

const canonicalContacts = {
  whatsapp: '79166554595',
  phone: '+79166554595',
  email: 'iconamaster@yandex.ru',
  sourceUrl: 'https://iconamaster.cargo.site/KONTAKTY',
  mapUrl: 'https://yandex.com/maps/-/CTT2bAoq',
  address: {
    display: 'Московская область, д. Брёхово, Ромашковая ул., 16',
    streetAddress: 'Ромашковая ул., 16',
    addressLocality: 'д. Брёхово',
    addressRegion: 'Московская область',
    addressCountry: 'RU',
  },
};

const validImage = {
  src: '/assets/pages/example.jpg',
  alt: 'Икона, полный вид',
  width: 1200,
  height: 1600,
};

const sourceUrl = (slug) => `https://iconamaster.cargo.site/${slug.toUpperCase()}`;
const pageRecord = (slug, sections, overrides = {}) => ({
  id: slug,
  slug,
  title: `Page ${slug}`,
  published: true,
  order: 1,
  sourceUrl: sourceUrl(slug),
  sections,
  ...overrides,
});
const articleRecord = (slug, sections, overrides = {}) => ({
  id: slug,
  slug,
  title: `Article ${slug}`,
  summary: `Summary ${slug}`,
  image: {
    ...validImage,
    src: `/assets/articles/${slug}.jpg`,
    sha256: 'a'.repeat(64),
    provenance: 'fixture-cover',
  },
  published: true,
  order: 1,
  sourceUrl: sourceUrl(slug),
  sections,
  ...overrides,
});
const videoRecord = (provider, id, overrides = {}) => ({
  provider,
  id,
  title: `Video ${provider}`,
  description: `Description ${provider}`,
  autoplay: false,
  published: true,
  sourceUrl: 'https://iconamaster.cargo.site/VIDEO',
  ...overrides,
});

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
    pages: [pageRecord('page', [{ type: 'image', image: null }])],
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

test('integrity validator accepts canonical Dzen article sources without relaxing page sources', () => {
  const article = articleRecord('dzen-story', [{ type: 'text', paragraphs: ['Материал'] }], {
    sourceUrl: 'https://dzen.ru/a/ak_PywErdWEdTZrn',
  });
  const page = pageRecord('dzen-page', [{ type: 'text', paragraphs: ['Материал'] }], {
    sourceUrl: 'https://dzen.ru/a/ak_PywErdWEdTZrn',
  });
  const errors = verifyContent(bundle({ articles: [article], pages: [page] }), new Set([
    '/assets/articles/dzen-story.jpg',
  ]));

  assert.doesNotMatch(errors.join('\n'), /article dzen-story field sourceUrl/);
  assert.ok(errors.includes('page dzen-page field sourceUrl must be an HTTPS iconamaster.cargo.site URL'));
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
      pageRecord('unsafe', [{ type: 'image', image: { ...validImage, src: '/assets/pages/%2e%2e/private.jpg' } }]),
      pageRecord('external', [{ type: 'image', image: { ...validImage, src: '//cdn.example.test/image.jpg' } }]),
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
    pages: [pageRecord('nested', [{
        type: 'text',
        heading: 'Безопасный заголовок',
        paragraphs: ['Абзац'],
        children: [
          { type: 'text', heading: ' ', paragraphs: [] },
          { type: 'gallery', images: [] },
          { type: 'unsupported', value: '<script>alert(1)</script>' },
          { type: 'image', image: validImage, autoplay: true },
        ],
      }])],
  }), new Set([validImage.src]));

  assert.ok(errors.includes('page nested contains an empty text block'));
  assert.ok(errors.includes('page nested contains an empty gallery block'));
  assert.ok(errors.includes('page nested contains unsupported block type unsupported'));
  assert.ok(errors.includes('page nested contains raw executable HTML'));
  assert.ok(errors.includes('page nested enables autoplay'));
});

test('recursive block validation rejects primitive, null, untyped, and malformed media entries', () => {
  const sections = [
    null,
    'primitive',
    {},
    {
      type: 'text',
      paragraphs: ['Parent'],
      children: [null, {}, { type: 'image', image: 'not-an-image' }],
    },
    { type: 'gallery', images: [null, { ...validImage, width: 0 }] },
  ];
  const errors = verifyContent(bundle({
    pages: [pageRecord('malformed', sections)],
  }), new Set([validImage.src]));

  for (const expected of [
    'page malformed contains malformed block at sections[0]',
    'page malformed contains malformed block at sections[1]',
    'page malformed contains untyped block at sections[2]',
    'page malformed contains malformed block at sections[3].children[0]',
    'page malformed contains untyped block at sections[3].children[1]',
    'page malformed image block must be an object',
    'page malformed gallery image 1 must be an object',
    'page malformed contains a gallery without a valid image',
  ]) assert.ok(errors.includes(expected), expected);
});

test('asset path validation rejects traversal and URL decoration variants', () => {
  const cases = [
    '/assets/pages/../private.jpg',
    '/assets/pages/%2e%2e/private.jpg',
    '/assets/pages/%252e%252e/private.jpg',
    '/assets/pages\\private.jpg',
    '/assets/pages/example.jpg?download=1',
    '/assets/pages/example.jpg#fragment',
    '/assets/pages/%zz.jpg',
    '/assets/pages/',
  ];

  for (const [index, src] of cases.entries()) {
    const slug = `unsafe-${index + 1}`;
    const errors = verifyContent(bundle({
      pages: [pageRecord(slug, [{ type: 'image', image: { ...validImage, src } }])],
    }), new Set());
    assert.ok(errors.includes(`page ${slug} image block has invalid asset path ${src}`), src);
  }
});

test('integrity validator requires direct recognized root-relative aliases and reports loops', () => {
  const errors = verifyContent(bundle({
    icons: [{ slug: 'known-icon', published: false, images: [] }],
    pages: [pageRecord('workshop', [{ type: 'text', paragraphs: ['Текст'] }])],
    articles: [articleRecord('known-article', [{ type: 'text', paragraphs: ['Текст'] }])],
    aliases: {
      '/good-icon': '/icons/known-icon',
      '/missing-icon': '/icons/missing',
      '/unknown': '/nowhere',
      '/external': 'https://example.test/collection',
      '/loop-a': '/loop-b',
      '/loop-b': '/loop-a',
    },
  }), new Set(['/assets/articles/known-article.jpg']));

  assert.ok(!errors.some((error) => error.includes('/good-icon')));
  assert.ok(errors.includes('alias /missing-icon targets missing icon missing'));
  assert.ok(errors.includes('alias /unknown has unrecognized target /nowhere'));
  assert.ok(errors.includes('alias /external target must be root-relative: https://example.test/collection'));
  assert.ok(errors.includes('alias loop detected: /loop-a -> /loop-b -> /loop-a'));
});

test('alias validation matches runtime resolution and rejects normalization, collisions, and chains', () => {
  const cases = [
    {
      aliases: { '/legacy/': '/collection' },
      expected: 'alias path must use its exact normalized form: /legacy/',
    },
    {
      aliases: { '/legacy': '/collection/' },
      expected: 'alias /legacy target must use exact canonical form /collection',
    },
    {
      aliases: { '/collection': '/contacts' },
      expected: 'alias key collides with canonical route: /collection',
    },
    {
      aliases: { '/legacy': '/middle', '/middle': '/collection' },
      expected: 'alias /legacy uses unsupported alias chain through /middle',
    },
    {
      aliases: { '/legacy': '/collection', '/collection': '/contacts' },
      expected: 'alias /legacy runtime route does not match target route /collection',
    },
  ];

  for (const { aliases, expected } of cases) {
    const errors = verifyContent(bundle({ aliases }), new Set());
    assert.ok(errors.includes(expected), `${expected}\n${errors.join('\n')}`);
  }
});

test('alias validation rejects literal and encoded decoded dot segments in keys and targets', () => {
  const cases = [
    {
      aliases: { '/legacy/./path': '/collection' },
      expected: 'alias path contains a decoded dot segment: /legacy/./path',
    },
    {
      aliases: { '/legacy/%2e/path': '/collection' },
      expected: 'alias path contains a decoded dot segment: /legacy/%2e/path',
    },
    {
      aliases: { '/legacy': '/./collection' },
      expected: 'alias /legacy target contains a decoded dot segment: /./collection',
    },
    {
      aliases: { '/legacy': '/%2e/collection' },
      expected: 'alias /legacy target contains a decoded dot segment: /%2e/collection',
    },
  ];

  for (const { aliases, expected } of cases) {
    const errors = verifyContent(bundle({ aliases }), new Set());
    assert.ok(errors.includes(expected), `${expected}\n${errors.join('\n')}`);
  }
});

test('video contract rejects duplicate provider ids and exact-set multiplicity drift', () => {
  const errors = verifyContent(bundle({
    videos: [
      videoRecord('youtube', 'y10sw1KIOqQ'),
      videoRecord('youtube', 'y10sw1KIOqQ'),
      videoRecord('vimeo', '353365425'),
    ],
  }), new Set(), {
    expected: {
      videos: [
        { provider: 'youtube', id: 'y10sw1KIOqQ', published: true },
        { provider: 'vimeo', id: '353365425', published: true },
      ],
    },
  });

  assert.ok(errors.includes('duplicate video youtube:y10sw1KIOqQ'));
  assert.ok(errors.includes('videos contract expected 2 records but found 3'));
  assert.ok(errors.includes('videos contract has 2 copies of youtube:y10sw1KIOqQ; expected 1'));
});

test('exact page, article, and video contracts require their records to remain published', () => {
  const page = pageRecord('required-page', [{ type: 'text', paragraphs: ['Text'] }], { published: false });
  const article = articleRecord('required-article', [{ type: 'text', paragraphs: ['Text'] }], { published: false });
  const video = videoRecord('youtube', 'y10sw1KIOqQ', { published: false });
  const errors = verifyContent(bundle({ pages: [page], articles: [article], videos: [video] }), new Set([
    '/assets/articles/required-article.jpg',
  ]), {
    expected: {
      pages: [{ slug: 'required-page', published: true }],
      articles: [{ slug: 'required-article', published: true }],
      videos: [{ provider: 'youtube', id: 'y10sw1KIOqQ', published: true }],
    },
  });

  assert.ok(errors.includes('pages contract requires published slug required-page'));
  assert.ok(errors.includes('articles contract requires published slug required-article'));
  assert.ok(errors.includes('videos contract requires published youtube:y10sw1KIOqQ'));
});

test('typed blocks and context-specific images reject unknown nested fields', () => {
  const page = pageRecord('nested-fields', [
    { type: 'text', paragraphs: ['Text'], embedUrl: 'https://example.test/embed' },
    { type: 'image', image: { ...validImage, embedUrl: 'https://example.test/embed', source: 'external' } },
    { type: 'gallery', images: [validImage], source: 'external', executable: 'javascript:alert(1)' },
  ]);
  const article = articleRecord('cover-fields', [{ type: 'text', paragraphs: ['Text'] }], {
    image: {
      ...articleRecord('cover-fields', []).image,
      embedUrl: 'https://example.test/embed',
      fit: 'cover',
    },
  });
  const icon = {
    slug: 'icon-fields',
    published: true,
    images: [{
      ...validImage,
      src: '/assets/icons/icon-fields.jpg',
      fit: 'contain',
      position: 'center',
      provenance: 'not-valid-in-content-image',
    }],
  };
  const errors = verifyContent(bundle({ pages: [page], articles: [article], icons: [icon] }), new Set([
    validImage.src,
    '/assets/articles/cover-fields.jpg',
    '/assets/icons/icon-fields.jpg',
  ]));

  for (const expected of [
    'page nested-fields text block contains unknown field embedUrl',
    'page nested-fields image block contains unknown field embedUrl',
    'page nested-fields image block contains unknown field source',
    'page nested-fields gallery block contains unknown field executable',
    'page nested-fields gallery block contains unknown field source',
    'article cover-fields cover contains unknown field embedUrl',
    'article cover-fields cover contains unknown field fit',
    'icon icon-fields image 1 contains unknown field provenance',
    'page nested-fields contains raw executable HTML',
  ]) assert.ok(errors.includes(expected), expected);
});

test('page, article, video, and contact records enforce required types, source metadata, and known fields', () => {
  const page = pageRecord('bad-page', [{ type: 'text', paragraphs: ['Text'] }], {
    id: '',
    published: 'yes',
    order: 1.5,
    sourceUrl: 'http://example.test/page',
    extra: true,
  });
  const article = articleRecord('bad-article', [{ type: 'text', paragraphs: ['Text'] }], {
    summary: null,
    image: null,
  });
  const video = videoRecord('youtube', 'short', {
    embedUrl: 'https://www.youtube.com/embed/short?autoplay=1',
  });
  const contacts = { ...canonicalContacts, sourceUrl: 'not-a-url', extra: true };
  const errors = verifyContent(bundle({ pages: [page], articles: [article], videos: [video], contacts }), new Set());

  for (const expected of [
    'page bad-page field id must be a non-empty string',
    'page bad-page field published must be a boolean',
    'page bad-page field order must be a positive integer',
    'page bad-page field sourceUrl must be an HTTPS iconamaster.cargo.site URL',
    'page bad-page contains unknown field extra',
    'article bad-article field summary must be a non-empty string',
    'article bad-article field image must be an image object',
    'video youtube:short field id is invalid for provider youtube',
    'video youtube:short contains unknown field embedUrl',
    'contacts field sourceUrl must be an HTTPS iconamaster.cargo.site URL',
    'contacts contains unknown field extra',
  ]) assert.ok(errors.includes(expected), expected);
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
      videos: [
        { provider: 'youtube', id: 'y10sw1KIOqQ', published: true },
        { provider: 'vimeo', id: '353365425', published: true },
      ],
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

test('integrity validator rejects incomplete or unsafe canonical address data', () => {
  const cases = [
    {
      contacts: { ...canonicalContacts, address: { ...canonicalContacts.address, display: '' } },
      expected: 'contacts address field display must be a non-empty string',
    },
    {
      contacts: { ...canonicalContacts, address: { ...canonicalContacts.address, addressCountry: 'US' } },
      expected: 'contacts address field addressCountry must be RU',
    },
    {
      contacts: { ...canonicalContacts, mapUrl: 'http://yandex.com/maps/-/CTT2bAoq' },
      expected: 'contacts field mapUrl must be an HTTPS URL',
    },
    {
      contacts: { ...canonicalContacts, address: { ...canonicalContacts.address, extra: true } },
      expected: 'contacts address contains unknown field extra',
    },
  ];

  for (const { contacts, expected } of cases) {
    assert.ok(verifyContent(bundle({ contacts }), new Set()).includes(expected), expected);
  }
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
    articles: 10,
    videos: 2,
    aliases: 78,
    referencedAssets: 272,
    ownedAssets: 272,
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

test('editorial verifier streams originals and covers in deterministic source order', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'iconamaster-editorial-gate-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const publicDirectory = path.join(root, 'public');
  await Promise.all([
    mkdir(path.join(publicDirectory, 'assets', 'pages'), { recursive: true }),
    mkdir(path.join(publicDirectory, 'assets', 'articles', 'covers'), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(publicDirectory, 'assets', 'pages', 'z.jpg'), 'z-original'),
    writeFile(path.join(publicDirectory, 'assets', 'pages', 'a.jpg'), 'a-original'),
    writeFile(path.join(publicDirectory, 'assets', 'articles', 'covers', 'cover.jpg'), 'cover'),
  ]);
  const errors = await verifyEditorialAssetFiles({
    publicDirectory,
    editorialReport: {
      assets: [
        { src: '/assets/pages/z.jpg', bytes: 1, sha256: '0'.repeat(64) },
        { src: '/assets/pages/a.jpg', bytes: 10, sha256: '0'.repeat(64) },
      ],
      coverAssets: [
        { src: '/assets/articles/covers/cover.jpg', bytes: 5, sha256: '0'.repeat(64) },
      ],
    },
  });

  assert.deepEqual(errors, [
    'editorial asset checksum mismatch: /assets/articles/covers/cover.jpg',
    'editorial asset checksum mismatch: /assets/pages/a.jpg',
    'editorial asset byte count mismatch: /assets/pages/z.jpg',
    'editorial asset checksum mismatch: /assets/pages/z.jpg',
  ]);
});

test('content directory inspection rejects directories and linked JSON entries', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'iconamaster-content-root-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'real.json'), '{}');
  await writeFile(path.join(directory, '..valid.json'), '{}');
  await mkdir(path.join(directory, 'directory.json'));
  let linked = true;
  try {
    await symlink(path.join(directory, 'real.json'), path.join(directory, 'linked.json'), 'file');
  } catch (error) {
    if (!['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) throw error;
    linked = false;
  }

  const errors = [];
  const files = await inspectContentDirectory(directory, errors);
  assert.deepEqual(files, ['..valid.json', 'real.json']);
  assert.ok(errors.includes('content directory contains a non-file: directory.json'));
  if (linked) assert.ok(errors.includes('content directory contains a symbolic link: linked.json'));
});

test('icon verifier accepts a contained filename beginning with two dots', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'iconamaster-icon-dot-prefix-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from('safe dot-prefix original');
  await writeFile(path.join(directory, '..valid.jpg'), bytes);
  const source = 'https://freight.cargo.site/t/original/dot-prefix.jpg';
  assert.deepEqual(await verifyIconAssetSet({
    assetDirectory: directory,
    manifest: [{
      file: '..valid.jpg',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      width: 1,
      height: 1,
      sourceUrl: source,
      legacyPath: '/DOT-PREFIX',
      role: 'original',
      provenance: 'fixture-original',
    }],
    allowedOwners: new Map([[source, '/DOT-PREFIX']]),
  }), []);
});

test('icon verifier sorts entry diagnostics and catches checksum drift', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'iconamaster-icon-order-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await Promise.all([
    mkdir(path.join(directory, 'z-directory')),
    mkdir(path.join(directory, 'a-directory')),
    writeFile(path.join(directory, 'drift.jpg'), 'drift'),
  ]);
  const errors = await verifyIconAssetSet({
    assetDirectory: directory,
    manifest: [{
      file: 'drift.jpg',
      bytes: 5,
      sha256: '0'.repeat(64),
      width: 1,
      height: 1,
      sourceUrl: 'https://freight.cargo.site/t/original/drift.jpg',
      legacyPath: '/DRIFT',
      role: 'original',
      provenance: 'fixture-original',
    }],
    allowedOwners: new Map([['https://freight.cargo.site/t/original/drift.jpg', '/DRIFT']]),
  });
  assert.deepEqual(errors, [
    'icon asset directory contains a non-file: a-directory',
    'icon asset directory contains a non-file: z-directory',
    'original asset checksum mismatch: drift.jpg',
  ]);
});

test('icon verifier rejects a linked asset root where the platform permits links', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'iconamaster-icon-linked-root-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'target');
  const linkedRoot = path.join(root, 'linked');
  await mkdir(target);
  try {
    await symlink(target, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return;
    throw error;
  }
  assert.deepEqual(await verifyIconAssetSet({
    assetDirectory: linkedRoot,
    manifest: [],
    allowedOwners: new Map(),
  }), ['icon asset root must be a real directory']);
});

test('standalone icon project verifier rejects a linked assets parent', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'iconamaster-icon-parent-link-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'project');
  const externalAssets = path.join(root, 'external-assets');
  await Promise.all([
    mkdir(path.join(project, 'public'), { recursive: true }),
    mkdir(path.join(externalAssets, 'icons'), { recursive: true }),
  ]);
  try {
    await symlink(externalAssets, path.join(project, 'public', 'assets'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return;
    throw error;
  }

  const result = await verifyIconAssetProject(project);
  assert.deepEqual(result.errors, ['icon asset parent chain must use real contained directories']);
});

test('content verifier CLI exits non-zero for a broken project fixture', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'iconamaster-broken-cli-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const contentDirectory = path.join(root, 'public', 'content');
  await mkdir(contentDirectory, { recursive: true });
  await writeFile(path.join(contentDirectory, 'manifest.json'), '{broken json');
  const script = fileURLToPath(new URL('../../scripts/verify-content.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, root], { encoding: 'utf8' });
  assert.notEqual(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
