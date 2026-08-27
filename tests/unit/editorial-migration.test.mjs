import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const recordPath = ({ sourceUrl }) => new URL(sourceUrl).pathname;

const imagesIn = (record) => record.sections.flatMap((section) => (
  section.type === 'image' ? [section.image]
    : section.type === 'gallery' ? section.images
      : []
));

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

test('every migrated editorial image has local bytes and durable provenance', async () => {
  const [pages, articles, report] = await Promise.all([
    json('../../public/content/pages.json'),
    json('../../public/content/articles.json'),
    json('../../reports/editorial-migration.json'),
  ]);
  const assetsBySrc = new Map(report.assets.map((asset) => [asset.src, asset]));
  const images = [...pages, ...articles].flatMap(imagesIn);

  assert.equal(new Set(report.assets.map(({ src }) => src)).size, report.assets.length);
  assert.equal(report.summary.relevantImageSources, 171);
  assert.equal(report.summary.assetFiles + report.summary.omittedImageSources, 171);
  for (const image of images) {
    assert.deepEqual(Object.keys(image).toSorted(), ['alt', 'height', 'src', 'width']);
    assert.match(image.src, /^\/assets\/(?:pages|articles)\//);
    assert.ok(image.alt.trim());
    assert.ok(image.width > 0 && image.height > 0, image.src);

    const asset = assetsBySrc.get(image.src);
    assert.ok(asset, `missing report asset for ${image.src}`);
    assert.equal(asset.width, image.width);
    assert.equal(asset.height, image.height);
    assert.ok(asset.sourceRef);
    assert.ok(asset.provenance);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);

    const bytes = await readFile(new URL(`../../public${image.src}`, import.meta.url));
    assert.equal(asset.bytes, bytes.length, image.src);
    assert.equal(asset.sha256, sha256(bytes), image.src);
  }
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
