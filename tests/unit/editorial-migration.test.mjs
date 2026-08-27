import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const json = async (relativePath) => JSON.parse(
  await readFile(new URL(relativePath, import.meta.url), 'utf8'),
);

const expectedArticleTitles = [
  'Иконы Горбуновых из села Холуя',
  'Кинешма — иконописный центр старообрядчества',
  'Иконы Русского Пантелеймонова монастыря',
  'Икона Богородицы Русская / Взбранная Воевода',
  'Павлово-на-Оке — старообрядческий иконописный центр',
  'История развития и стили окладов икон',
  'Иконописный канон как место духовной брани',
  'Гуслица',
];

const expectedPagePaths = [
  '/EKSKURSIY-PO-MASTERSKOI',
  '/IKONOSTASY',
  '/KIOTY-I-REZ-BA',
  '/MERNAY-IKONA',
  '/MOSKOVSKAY-IKONOPISNAY-MASTERSKAY',
  '/OKLADY',
  '/RESTAVRATIY',
];

const expectedArticlePaths = [
  '/GUSLITA-ODIN-IZ-KRUPNEISIK-STAROOBRYDCESKIK-TENTROV-KNIGOPISANIY-I',
  '/IKONA-BOGORODITY-RUSSKAY-ILI-VZBRANNAY-VOEVODA-1',
  '/IKONOPISNYI-KANON-KAK-MESTO-DUKOVNOI-BRANI',
  '/IKONY-RUSSKOGO-PANTELEIMONOVA-MONASTYRY',
  '/ISTORIY-RAZVITIY-I-STILI-OKLADOV-IKON',
  '/KINESMA-STARYI-IKONOPISNYI-TENTR-STAROOBRYDCESTVA',
  '/PAVLOVO-NA-OKE-STAROOBRYDCESKII-IKONOPISNYI-TENTR',
  '/PIS-MA-GORBUNOVYK-IKONY-SELA-KOLUI',
];

const excludedArticlePath = '/IKONY-V-OKLADAK-TRADITIY-I-ISTORIY';
const expectedSourceFixtureHash = '7354aaca5c31045d59a9c165121e421d683e3fa0ff8a305bf267fc6635eec567';
const expectedCoverFixtureHash = '5dca8eb32a6520e53e312a6ff5c859bb2d500690bb6b8911d90a2e286fd70389';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const ownerKey = ({ ownerType, ownerSlug }) => `${ownerType}:${ownerSlug}`;

const recordPath = ({ sourceUrl }) => new URL(sourceUrl).pathname;

const imagesIn = (record) => record.sections.flatMap((section) => (
  section.type === 'image' ? [section.image]
    : section.type === 'gallery' ? section.images
      : []
));

const relativeFiles = async (directory, prefix = '') => {
  const directoryPath = directory instanceof URL ? fileURLToPath(directory) : directory;
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? relativeFiles(path.join(directoryPath, entry.name), relativePath)
      : [relativePath];
  }));
  return nested.flat().toSorted();
};

test('editorial migration contains exactly the agreed records and contact policy', async () => {
  const [pages, articles, videos, contacts] = await Promise.all([
    json('../../public/content/pages.json'),
    json('../../public/content/articles.json'),
    json('../../public/content/videos.json'),
    json('../../public/content/contacts.json'),
  ]);

  assert.deepEqual(pages.map(({ slug }) => slug).toSorted(), [
    'excursions',
    'iconostases',
    'kiots',
    'measure-icon',
    'oklads',
    'restoration',
    'workshop',
  ]);
  assert.deepEqual(articles.map(({ title }) => title), expectedArticleTitles);
  assert.deepEqual(videos.map(({ provider, id }) => `${provider}:${id}`), [
    'youtube:y10sw1KIOqQ',
    'vimeo:353365425',
  ]);
  assert.ok(videos.every(({ autoplay }) => autoplay === false));
  assert.equal(contacts.whatsapp, '79166554595');
  assert.equal(contacts.phone, '+79166554595');
  assert.equal(contacts.email, 'iconamaster@yandex.ru');
});

test('every approved source path has a root-relative same-tab alias', async () => {
  const [pages, articles, aliases] = await Promise.all([
    json('../../public/content/pages.json'),
    json('../../public/content/articles.json'),
    json('../../public/content/aliases.json'),
  ]);
  const records = [...pages, ...articles];
  const recordsByPath = new Map(records.map((record) => [recordPath(record), record]));

  assert.deepEqual([...recordsByPath.keys()].toSorted(), [
    ...expectedPagePaths,
    ...expectedArticlePaths,
  ].toSorted());
  for (const sourcePath of expectedPagePaths) {
    assert.equal(aliases[sourcePath], `/${recordsByPath.get(sourcePath).slug}`);
  }
  for (const sourcePath of expectedArticlePaths) {
    assert.equal(aliases[sourcePath], `/articles/${recordsByPath.get(sourcePath).slug}`);
  }
  assert.equal(aliases[excludedArticlePath], undefined);
  for (const [legacyPath, canonicalPath] of Object.entries(aliases)) {
    assert.match(legacyPath, /^\//);
    assert.match(canonicalPath, /^\//);
    assert.doesNotMatch(canonicalPath, /^(?:https?:)?\/\//);
  }
});

test('legacy aliases use exact locale-independent code-unit ordering', async () => {
  const { sortEntriesByCodeUnit } = await import('../../scripts/migrate-editorial-content.mjs');
  const aliases = await json('../../public/content/aliases.json');

  assert.equal(typeof sortEntriesByCodeUnit, 'function');
  assert.deepEqual(sortEntriesByCodeUnit([
    ['/я', 6],
    ['/Z', 1],
    ['/a', 2],
    ['/Я', 5],
    ['/Е', 4],
    ['/Ё', 3],
  ]).map(([key]) => key), ['/Z', '/a', '/Ё', '/Е', '/Я', '/я']);
  assert.deepEqual(Object.keys(aliases), Object.keys(aliases).toSorted());
});

test('pages and articles contain only non-empty ordered structured blocks', async () => {
  const { countMojibakeMarkers } = await import('../../scripts/migrate-editorial-content.mjs');
  const [pages, articles] = await Promise.all([
    json('../../public/content/pages.json'),
    json('../../public/content/articles.json'),
  ]);

  for (const record of [...pages, ...articles]) {
    assert.equal(record.published, true, record.slug);
    assert.ok(record.sourceUrl.startsWith('https://iconamaster.cargo.site/'), record.slug);
    assert.ok(record.sections.length > 0, record.slug);

    for (const section of record.sections) {
      assert.ok(['text', 'image', 'gallery'].includes(section.type), `${record.slug}:${section.type}`);
      if (section.type === 'text') {
        assert.ok(section.heading || section.paragraphs.length > 0, record.slug);
        assert.ok(section.paragraphs.every((paragraph) => paragraph.trim()), record.slug);
      } else if (section.type === 'image') {
        assert.ok(section.image, record.slug);
      } else {
        assert.ok(section.images.length > 0, record.slug);
      }
    }

    const serialized = JSON.stringify(record);
    assert.doesNotMatch(serialized, /<\/?(?:script|style|iframe|img|div|span|font|a)\b/iu, record.slug);
    assert.equal(countMojibakeMarkers(serialized), 0, record.slug);
  }

  const workshop = pages.find(({ slug }) => slug === 'workshop');
  const kiots = pages.find(({ slug }) => slug === 'kiots');
  assert.ok(workshop.sections.some(({ type }) => type === 'text'));
  assert.equal(imagesIn(workshop).length, 0);
  assert.ok(kiots.sections.every(({ type }) => type === 'gallery'));
  assert.ok(imagesIn(kiots).length > 0);
});

test('source fixture durable hash is identical for LF and CRLF representations', async () => {
  const { canonicalJsonSha256FromText } = await import('../../scripts/migrate-editorial-content.mjs');
  const fixtureText = await readFile(
    new URL('../fixtures/migration/editorial-source-assets.json', import.meta.url),
    'utf8',
  );
  const report = await json('../../reports/editorial-migration.json');
  const lf = fixtureText.replace(/\r\n/gu, '\n');
  const crlf = lf.replace(/\n/gu, '\r\n');

  assert.equal(typeof canonicalJsonSha256FromText, 'function');
  assert.equal(canonicalJsonSha256FromText(lf), expectedSourceFixtureHash);
  assert.equal(canonicalJsonSha256FromText(crlf), expectedSourceFixtureHash);
  assert.equal(report.sourceAssetFixture.sha256, expectedSourceFixtureHash);
});

test('frozen source ownership fixture matches content, report and original files bijectively', async () => {
  const { validateSourceOwnershipFixture } = await import('../../scripts/migrate-editorial-content.mjs');
  const fixtureUrl = new URL('../fixtures/migration/editorial-source-assets.json', import.meta.url);
  const [pages, articles, report, fixtureBytes] = await Promise.all([
    json('../../public/content/pages.json'),
    json('../../public/content/articles.json'),
    json('../../reports/editorial-migration.json'),
    readFile(fixtureUrl),
  ]);
  const fixture = JSON.parse(fixtureBytes);
  const records = [
    ...pages.map((record) => ({ ownerType: 'page', ownerSlug: record.slug, record })),
    ...articles.map((record) => ({ ownerType: 'article', ownerSlug: record.slug, record })),
  ];
  const recordsByOwner = new Map(records.map((entry) => [ownerKey(entry), entry.record]));
  const assetsByOwner = new Map(fixture.records.map((entry) => [ownerKey(entry), []]));
  const assetsBySrc = new Map(report.assets.map((asset) => [asset.src, asset]));

  assert.equal(typeof validateSourceOwnershipFixture, 'function');
  assert.deepEqual(report.sourceAssetFixture, {
    path: 'tests/fixtures/migration/editorial-source-assets.json',
    schemaVersion: 1,
    sha256: expectedSourceFixtureHash,
  });
  assert.deepEqual(fixture.records.map(ownerKey), records.map(ownerKey));

  assert.equal(new Set(report.assets.map(({ src }) => src)).size, report.assets.length);
  assert.equal(report.summary.relevantImageSources, 171);
  assert.equal(report.assets.length + report.summary.omittedImageSources, 171);
  for (const asset of report.assets) {
    const owned = assetsByOwner.get(ownerKey(asset));
    assert.ok(owned, `unknown report owner ${ownerKey(asset)}`);
    owned.push(asset);
    assert.ok(asset.sourceRef);
    assert.ok(asset.provenance);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);

    const bytes = await readFile(new URL(`../../public${asset.src}`, import.meta.url));
    assert.equal(asset.bytes, bytes.length, asset.src);
    assert.equal(asset.sha256, sha256(bytes), asset.src);
  }

  for (const expected of fixture.records) {
    const key = ownerKey(expected);
    const record = recordsByOwner.get(key);
    const assets = assetsByOwner.get(key).toSorted((left, right) => left.order - right.order);
    assert.ok(record, `missing content owner ${key}`);
    assert.deepEqual(assets.map(({ order }) => order), expected.sha256.map((_, index) => index + 1), key);
    assert.deepEqual(assets.map(({ sha256: checksum }) => checksum), expected.sha256, key);
    assert.deepEqual(
      [...new Set(imagesIn(record).map(({ src }) => src))],
      assets.map(({ src }) => src),
      key,
    );
  }

  assert.doesNotThrow(() => validateSourceOwnershipFixture(report.assets, fixture));
  assert.throws(() => validateSourceOwnershipFixture([
    { ownerType: 'page', ownerSlug: 'one', order: 1, sha256: 'a'.repeat(64), sourceRef: 'source:shared' },
    { ownerType: 'page', ownerSlug: 'two', order: 1, sha256: 'a'.repeat(64), sourceRef: 'source:shared' },
  ], {
    schemaVersion: 1,
    crossOwnerReuseAllowlist: [],
    records: [
      { ownerType: 'page', ownerSlug: 'one', sha256: ['a'.repeat(64)] },
      { ownerType: 'page', ownerSlug: 'two', sha256: ['a'.repeat(64)] },
    ],
  }), /unapproved cross-owner reuse/iu);

  for (const record of records.map(({ record: contentRecord }) => contentRecord)) {
    for (const image of imagesIn(record)) {
      assert.deepEqual(Object.keys(image).toSorted(), ['alt', 'height', 'src', 'width']);
      assert.match(image.src, /^\/assets\/(?:pages|articles)\//);
      assert.ok(image.alt.trim());
      assert.ok(image.width > 0 && image.height > 0, image.src);
      const asset = assetsBySrc.get(image.src);
      assert.ok(asset, `missing report asset for ${image.src}`);
      assert.equal(image.width, asset.width, image.src);
      assert.equal(image.height, asset.height, image.src);
    }
  }
});

test('validated staging replacement removes stale editorial assets and preserves unrelated roots', async () => {
  const { replaceEditorialAssetDirectories } = await import('../../scripts/migrate-editorial-content.mjs');
  assert.equal(typeof replaceEditorialAssetDirectories, 'function');

  const root = await mkdtemp(path.join(tmpdir(), 'iconamaster-editorial-swap-'));
  const assetsRoot = path.join(root, 'public', 'assets');
  const stagingRoot = path.join(root, 'staging');
  try {
    await Promise.all([
      mkdir(path.join(assetsRoot, 'pages'), { recursive: true }),
      mkdir(path.join(assetsRoot, 'articles'), { recursive: true }),
      mkdir(path.join(assetsRoot, 'icons'), { recursive: true }),
      mkdir(path.join(stagingRoot, 'pages'), { recursive: true }),
      mkdir(path.join(stagingRoot, 'articles', 'covers'), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(path.join(assetsRoot, 'pages', 'stale.jpg'), 'stale-page'),
      writeFile(path.join(assetsRoot, 'articles', 'stale.jpg'), 'stale-article'),
      writeFile(path.join(assetsRoot, 'icons', 'keep.jpg'), 'keep-icon'),
      writeFile(path.join(stagingRoot, 'pages', 'fresh.jpg'), 'fresh-page'),
      writeFile(path.join(stagingRoot, 'articles', 'fresh.jpg'), 'fresh-article'),
      writeFile(path.join(stagingRoot, 'articles', 'covers', 'fresh.jpg'), 'fresh-cover'),
    ]);

    await replaceEditorialAssetDirectories({ assetsRoot, stagingRoot });

    assert.deepEqual(await relativeFiles(path.join(assetsRoot, 'pages')), ['fresh.jpg']);
    assert.deepEqual(await relativeFiles(path.join(assetsRoot, 'articles')), [
      'covers/fresh.jpg',
      'fresh.jpg',
    ]);
    assert.equal(await readFile(path.join(assetsRoot, 'icons', 'keep.jpg'), 'utf8'), 'keep-icon');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('pinned cover encoder and derivative contract rejects identity and checksum drift', async () => {
  const {
    validateCoverAssetFixture,
    validateCoverEncoderIdentity,
  } = await import('../../scripts/migrate-editorial-content.mjs');
  const [fixture, report] = await Promise.all([
    json('../fixtures/migration/editorial-cover-assets.json'),
    json('../../reports/editorial-migration.json'),
  ]);
  const fixtureAssets = fixture.records.map((record) => ({
    ...record,
    provenance: fixture.provenance,
    transform: fixture.transform,
  }));

  assert.equal(typeof validateCoverEncoderIdentity, 'function');
  assert.equal(typeof validateCoverAssetFixture, 'function');
  assert.doesNotThrow(() => validateCoverEncoderIdentity(fixture.encoder, fixture.encoder));
  assert.throws(() => validateCoverEncoderIdentity({
    ...fixture.encoder,
    binarySha256: '0'.repeat(64),
  }, fixture.encoder), /cover encoder identity mismatch/iu);
  assert.doesNotThrow(() => validateCoverAssetFixture(fixtureAssets, fixture));
  assert.throws(() => validateCoverAssetFixture([
    { ...fixtureAssets[0], sha256: '0'.repeat(64) },
    ...fixtureAssets.slice(1),
  ], fixture), /cover asset fixture mismatch/iu);
  assert.doesNotThrow(() => validateCoverAssetFixture(report.coverAssets, fixture));
});

test('article cards use smaller derived covers while full originals and disk bijection remain intact', async () => {
  const [pages, articles, report, fixture] = await Promise.all([
    json('../../public/content/pages.json'),
    json('../../public/content/articles.json'),
    json('../../reports/editorial-migration.json'),
    json('../fixtures/migration/editorial-cover-assets.json'),
  ]);
  const originalsBySrc = new Map(report.assets.map((asset) => [asset.src, asset]));
  const coversByOwner = new Map((report.coverAssets ?? []).map((asset) => [asset.ownerSlug, asset]));
  const expectedByOwner = new Map(fixture.records.map((asset) => [asset.ownerSlug, asset]));
  const expectedCoverAssets = fixture.records.map((record) => ({
    ...record,
    provenance: fixture.provenance,
    transform: fixture.transform,
  }));

  assert.equal(report.coverAssets?.length, 8);
  assert.equal(report.summary.originalAssetFiles, 171);
  assert.equal(report.summary.coverAssetFiles, 8);
  assert.equal(report.summary.assetFiles, 179);
  assert.deepEqual(report.coverAssetFixture, {
    path: 'tests/fixtures/migration/editorial-cover-assets.json',
    schemaVersion: 1,
    sha256: expectedCoverFixtureHash,
  });
  assert.deepEqual(report.coverEncoder, fixture.encoder);
  assert.deepEqual(report.coverAssets, expectedCoverAssets);
  for (const article of articles) {
    const cover = coversByOwner.get(article.slug);
    const expected = expectedByOwner.get(article.slug);
    assert.ok(cover, `missing cover for ${article.slug}`);
    assert.ok(expected, `missing fixture cover for ${article.slug}`);
    assert.equal(cover.ownerType, 'article');
    assert.equal(article.image.src, cover.src);
    assert.equal(article.image.width, cover.width);
    assert.equal(article.image.height, cover.height);
    assert.equal(article.image.sha256, expected.sha256);
    assert.equal(article.image.provenance, fixture.provenance);
    assert.match(cover.src, /^\/assets\/articles\/covers\/[a-z0-9-]+\.jpg$/u);
    assert.equal(cover.provenance, fixture.provenance);
    assert.deepEqual(cover.transform, fixture.transform);
    assert.ok(Math.max(cover.width, cover.height) <= 640, cover.src);
    assert.ok(Math.min(cover.width, cover.height) >= 300, cover.src);

    const source = originalsBySrc.get(cover.sourceAssetSrc);
    assert.ok(source, `missing full source for ${cover.src}`);
    assert.equal(source.ownerType, 'article');
    assert.equal(source.ownerSlug, article.slug);
    assert.equal(cover.sourceAssetSha256, source.sha256);
    assert.equal(cover.sourceRef, source.sourceRef);
    assert.ok(imagesIn(article).some(({ src }) => src === source.src), article.slug);
    assert.ok(cover.bytes < source.bytes * 0.75, `${cover.src}: ${cover.bytes} !< ${source.bytes} * 0.75`);

    const bytes = await readFile(new URL(`../../public${cover.src}`, import.meta.url));
    assert.equal(bytes.length, expected.bytes, cover.src);
    assert.equal(sha256(bytes), expected.sha256, cover.src);
  }

  const actualDiskFiles = [
    ...(await relativeFiles(new URL('../../public/assets/pages/', import.meta.url)))
      .map((file) => `/assets/pages/${file}`),
    ...(await relativeFiles(new URL('../../public/assets/articles/', import.meta.url)))
      .map((file) => `/assets/articles/${file}`),
  ].toSorted();
  const expectedDiskFiles = [
    ...report.assets.map(({ src }) => src),
    ...report.coverAssets.map(({ src }) => src),
  ].toSorted();
  assert.deepEqual(actualDiskFiles, expectedDiskFiles);
  assert.equal(pages.length, 7);
});

test('removes only the accepted literal source-debris marker', async () => {
  const { parseEditorialMarkup } = await import('../../scripts/migrate-editorial-content.mjs');
  const articles = await json('../../public/content/articles.json');
  const theotokos = articles.find(({ slug }) => slug === 'theotokos-russkaya');

  assert.doesNotMatch(JSON.stringify(theotokos), /<б131>/u);
  assert.deepEqual(
    parseEditorialMarkup('<p>Гран-при и Большой золотой медали. &lt;б131&gt;</p>')[0].paragraphs,
    ['Гран-при и Большой золотой медали.'],
  );
  assert.deepEqual(
    parseEditorialMarkup('<p>Сохраняемый маркер &lt;б132&gt;</p>')[0].paragraphs,
    ['Сохраняемый маркер <б132>'],
  );
});

test('known prayer soft line breaks match the committed paragraph segmentation fixture', async () => {
  const [articles, fixture] = await Promise.all([
    json('../../public/content/articles.json'),
    json('../fixtures/migration/editorial-text-segmentation.json'),
  ]);
  const article = articles.find(({ slug }) => slug === fixture.ownerSlug);
  const section = article.sections.find(({ type, paragraphs }) => (
    type === 'text' && paragraphs[0] === fixture.anchor
  ));

  assert.equal(fixture.schemaVersion, 1);
  assert.ok(section, `missing prayer section for ${fixture.ownerSlug}`);
  assert.deepEqual(section.paragraphs, fixture.expectedParagraphs);
});

test('durable editorial report accounts for exclusions, omissions, encoding and outputs', async () => {
  const report = await json('../../reports/editorial-migration.json');
  const serialized = JSON.stringify(report);

  assert.equal(report.schemaVersion, 1);
  assert.deepEqual(report.summary.records, {
    pages: 7,
    articles: 8,
    videos: 2,
    contacts: 1,
  });
  assert.equal(report.summary.unresolvedMojibakeMarkers, 0);
  assert.equal(report.encoding.unresolved.length, 0);
  assert.ok(report.encoding.repairedMarkers > 0);
  assert.equal(report.omittedBlocks.length, report.summary.omittedBlocks);
  assert.deepEqual(report.excludedArticleCandidates.map(({ legacyPath, decision }) => ({
    legacyPath,
    decision,
  })), [{
    legacyPath: excludedArticlePath,
    decision: 'excluded-by-controller-ruling',
  }]);
  assert.doesNotMatch(serialized, /(?:[A-Z]:\\|\/Users\/|generatedAt|timestamp|runAt)/u);

  for (const output of report.outputs) {
    const bytes = await readFile(new URL(`../../${output.path}`, import.meta.url));
    assert.equal(output.bytes, bytes.length, output.path);
    assert.equal(output.sha256, sha256(bytes), output.path);
  }
});

test('editorial parser removes executable markup while preserving ordered content roles', async () => {
  const { countMojibakeMarkers, parseEditorialMarkup } = await import('../../scripts/migrate-editorial-content.mjs');
  const blocks = parseEditorialMarkup(`
    <h2>Заголовок</h2>
    <p>Первый <script>alert(1)</script> абзац</p>
    <img data-src="https://example.test/one.jpg" width="1200" height="800">
    <div class="image-gallery">
      <img data-src="https://example.test/two.jpg" width="600" height="900">
      <img src="data:image/png;base64,aGVsbG8=">
    </div>
    <style>body { display: none }</style>
  `);

  assert.deepEqual(blocks.map(({ type }) => type), ['text', 'image', 'gallery']);
  assert.equal(blocks[0].heading, 'Заголовок');
  assert.deepEqual(blocks[0].paragraphs, ['Первый абзац']);
  assert.equal(blocks[1].source.sourceRef, 'https://example.test/one.jpg');
  assert.deepEqual(blocks[2].sources.map(({ sourceKind }) => sourceKind), ['remote', 'data-url']);
  assert.doesNotMatch(JSON.stringify(blocks), /alert|display:\s*none/u);
  assert.equal(countMojibakeMarkers('Имя «ИИС» сохранено без изменений.'), 0);
  assert.ok(countMojibakeMarkers('РњРµСЂРЅР°СЏ иконР°') > 0);

  const inline = parseEditorialMarkup('<p>Село Х<b>о́</b>луй сохраняет традицию.</p>');
  assert.deepEqual(inline[0].paragraphs, ['Село Хо́луй сохраняет традицию.']);
});
