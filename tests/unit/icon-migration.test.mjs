import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import { publicRecoverySources, verifiedSources } from '../../scripts/icon-sources.mjs';

const loadJson = async (relativePath) => JSON.parse(await readFile(
  new URL(relativePath, import.meta.url),
));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sorted = (values) => [...values].sort();
const correctedTitles = {
  'joy-of-all-who-sorrow-gilded-oklad': 'Икона Богородицы Радость всех скорбящих в старинном золоченом окладе',
  'archangel-michael': 'Икона чудо Архистратига Михаила.',
  'twelve-feasts-and-resurrection': 'Икона Двунадесятые праздники Воскресение Христово.',
  'christ-pantocrator-brass-oklad': 'Икона Спас Вседержитель в старинном латунном окладе'
};

const recoveryRequiredPaths = [
  '/IKONA-BOGORODITY-PETROVSKAY-V-REZNOM-KIOTE',
  '/IKONA-BOGORODITY-RUSSKAY',
  '/IKONA-BOGORODITY-TREK-RADOSTEI',
  '/IKONA-CUDO-AKISTRATIGA-MIKAILA',
  '/IKONA-PREPODOBNYE-ZOSIMA-I-SAVVATII-SOLOVETKIE',
  '/IKONA-SPAS-VSEDERZITEL-V-DRAGOTENNOM-OKLADE-S-FARFOROVYMI-VSTAVKAMI-I',
  '/IKONA-SVYTOI-KNYZ-VLADISLAV-CESSKII',
];

const buildAllowedOwners = (inventory) => {
  const ownersByUrl = new Map();
  const add = (sourceUrl, legacyPath, source) => {
    const owners = ownersByUrl.get(sourceUrl) ?? new Map();
    const evidence = owners.get(legacyPath) ?? new Set();
    evidence.add(source);
    owners.set(legacyPath, evidence);
    ownersByUrl.set(sourceUrl, owners);
  };

  for (const icon of inventory.icons) {
    for (const original of icon.originals) add(original.sourceUrl, icon.sourcePath, 'inventory-original');
  }
  for (const source of verifiedSources) add(source.sourceUrl, source.legacyPath, 'verified-seed');
  for (const source of publicRecoverySources) {
    for (const original of source.originals) add(original.sourceUrl, source.legacyPath, 'pinned-recovery');
  }
  return ownersByUrl;
};

test('catalog migration contains all 50 source records and no duplicate slugs', async () => {
  const icons = await loadJson('../../public/content/icons.json');
  assert.equal(icons.length, 50);
  assert.equal(new Set(icons.map(({ slug }) => slug)).size, 50);
});

test('migrated icon content preserves the original listed price and description', async () => {
  const icons = await loadJson('../../public/content/icons.json');
  const tsarIvan = icons.find(({ slug }) => slug === 'tsar-ivan-the-terrible');

  assert.equal(tsarIvan.price, '150 000 руб.');
  assert.equal(
    tsarIvan.description,
    '31х27 см., в профильном киоте с открывающейся дверкой из массива дуба 45х40 см., доска липа с двумя ковчегами и двумя врезными шпонками, холст, натуральный левкас, настоящая минеральная яичная темпера, червонное золото сусальное и твореное, копаловый лак. Икона писана в одном экземпляре, высокохудожественная ручная авторская работа.',
  );
});

test('asset failures are fatal except for unverified candidates on recovery-required records', async () => {
  const { migrateCandidates } = await import('../../scripts/migrate-icons.mjs');
  const verified = { verified: { file: 'immutable-original.jpg' }, sourceUrl: 'https://example.test/original.jpg' };
  const rejectCandidate = (candidate, recoveryRequired, error) => migrateCandidates({
    candidates: [candidate],
    recoveryRequired,
    legacyPath: '/RECOVERY-REQUIRED',
    migrateCandidate: async () => { throw error; },
  });

  for (const message of [
    'missing immutable original',
    'checksum mismatch for immutable original',
    'invalid dimensions for immutable original',
  ]) {
    const error = new Error(message);
    await assert.rejects(
      rejectCandidate(verified, true, error),
      (thrown) => thrown === error,
      message,
    );
  }

  const ordinaryError = new Error('ordinary inventory original failed');
  await assert.rejects(
    rejectCandidate({ sourceUrl: 'https://example.test/ordinary.jpg' }, false, ordinaryError),
    (thrown) => thrown === ordinaryError,
  );

  assert.deepEqual(await migrateCandidates({
    candidates: [{ sourceUrl: 'https://example.test/recovery.jpg' }],
    recoveryRequired: true,
    legacyPath: '/RECOVERY-REQUIRED',
    migrateCandidate: async () => { throw new Error('public original unavailable'); },
  }), {
    migratedAssets: [],
    assetFailures: [{
      legacyPath: '/RECOVERY-REQUIRED',
      sourceUrl: 'https://example.test/recovery.jpg',
      outcome: 'unavailable',
      error: 'public original unavailable',
    }],
    attempts: [{
      legacyPath: '/RECOVERY-REQUIRED',
      sourceUrl: 'https://example.test/recovery.jpg',
      outcome: 'unavailable',
      error: 'public original unavailable',
    }],
  });
});

test('every published icon has a local original with dimensions and alt text', async () => {
  const icons = await loadJson('../../public/content/icons.json');
  for (const icon of icons.filter(({ published }) => published)) {
    assert.ok(icon.images.length > 0, icon.slug);
    for (const image of icon.images) {
      assert.match(image.src, /^\/assets\/icons\//);
      assert.ok(image.width > 0 && image.height > 0 && image.alt, `${icon.slug}: ${image.src}`);
    }
  }
});

test('tracked inventory fixture accounts for all source titles, paths, and aliases', async () => {
  const [inventory, icons, aliases] = await Promise.all([
    loadJson('../fixtures/migration/icon-inventory.json'),
    loadJson('../../public/content/icons.json'),
    loadJson('../../public/content/aliases.json'),
  ]);
  const iconsBySourceUrl = new Map(icons.map((icon) => [icon.sourceUrl, icon]));

  assert.equal(inventory.schemaVersion, 2);
  assert.equal(inventory.icons.length, 50);
  assert.equal(inventory.icons.reduce((count, icon) => count + icon.originals.length, 0), 68);
  for (const source of inventory.icons) {
    const icon = iconsBySourceUrl.get(source.sourceUrl);
    assert.ok(icon, source.sourcePath);
    assert.equal(icon.title, correctedTitles[icon.slug] ?? source.title);
    assert.equal(aliases[source.sourcePath], `/icons/${icon.slug}`);
    assert.match(aliases[source.sourcePath], /^\//);
  }
});

test('published typo corrections update canonical titles and every generated image alt', async () => {
  const icons = await loadJson('../../public/content/icons.json');
  for (const [slug, expectedTitle] of Object.entries(correctedTitles)) {
    const icon = icons.find((record) => record.slug === slug);
    assert.ok(icon, slug);
    assert.equal(icon.title, expectedTitle, slug);
    assert.ok(icon.images.length > 0, slug);
    for (const image of icon.images) assert.ok(image.alt.startsWith(expectedTitle), `${slug}: ${image.alt}`);
  }
});

test('every manifest URL has exactly one pinned owner and rejects global scaffolding media', async () => {
  const [inventory, manifest] = await Promise.all([
    loadJson('../fixtures/migration/icon-inventory.json'),
    loadJson('../../public/assets/icons/manifest.json'),
  ]);
  const ownersByUrl = buildAllowedOwners(inventory);

  for (const [sourceUrl, owners] of ownersByUrl) {
    assert.equal(owners.size, 1, `ambiguous owner for ${sourceUrl}: ${[...owners.keys()].join(', ')}`);
  }
  assert.equal(ownersByUrl.size, 79, 'the pinned ownership allowlist must contain exactly 79 originals');
  assert.equal(new Set(manifest.map(({ sourceUrl }) => sourceUrl)).size, manifest.length, 'manifest URLs must be unique');
  assert.deepEqual(
    sorted(manifest.map(({ sourceUrl }) => sourceUrl)),
    sorted(ownersByUrl.keys()),
    'every pinned original must appear exactly once in the manifest',
  );
  for (const asset of manifest) {
    const owners = ownersByUrl.get(asset.sourceUrl);
    assert.ok(owners, `manifest URL has no pinned owner: ${asset.sourceUrl}`);
    assert.equal(owners.size, 1, `manifest URL has ambiguous ownership: ${asset.sourceUrl}`);
    assert.equal(asset.legacyPath, [...owners.keys()][0], asset.sourceUrl);
  }
  assert.equal(manifest.length, 79, 'global scaffolding media must not inflate the 79 owned originals');
});

test('icon images, manifest entries, and immutable files form a bijection', async () => {
  const [icons, manifest, diskEntries] = await Promise.all([
    loadJson('../../public/content/icons.json'),
    loadJson('../../public/assets/icons/manifest.json'),
    readdir(new URL('../../public/assets/icons/', import.meta.url), { withFileTypes: true }),
  ]);
  const imageRefs = icons.flatMap((icon) => icon.images.map((image) => ({ icon, image })));
  const imageFiles = imageRefs.map(({ image }) => image.src.split('/').at(-1));
  const manifestFiles = manifest.map(({ file }) => file);
  const diskFiles = diskEntries
    .filter((entry) => entry.isFile() && entry.name !== 'manifest.json')
    .map(({ name }) => name);

  assert.equal(new Set(imageFiles).size, imageFiles.length, 'an immutable file is referenced by multiple icon images');
  assert.equal(new Set(manifestFiles).size, manifestFiles.length, 'manifest filenames must be unique');
  assert.deepEqual(sorted(imageFiles), sorted(manifestFiles), 'icon image ↔ manifest mismatch');
  assert.deepEqual(sorted(manifestFiles), sorted(diskFiles), 'manifest ↔ disk mismatch');

  const imagesByFile = new Map(imageRefs.map(({ icon, image }) => [image.src.split('/').at(-1), { icon, image }]));
  for (const asset of manifest) {
    const owned = imagesByFile.get(asset.file);
    assert.ok(owned, asset.file);
    assert.equal(asset.legacyPath, new URL(owned.icon.sourceUrl).pathname, asset.file);
    assert.equal(owned.image.width, asset.width, asset.file);
    assert.equal(owned.image.height, asset.height, asset.file);
    assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    assert.equal(asset.role, 'original');
    assert.notEqual(asset.provenance, 'catalog-card-thumbnail');
  }
  for (const icon of icons.filter(({ published }) => !published)) assert.deepEqual(icon.images, [], icon.slug);
});

test('all seven recovery records retain every pinned owned asset and publication follows asset presence', async () => {
  const [inventory, icons, manifest] = await Promise.all([
    loadJson('../fixtures/migration/icon-inventory.json'),
    loadJson('../../public/content/icons.json'),
    loadJson('../../public/assets/icons/manifest.json'),
  ]);
  const fixtureRecoveryPaths = inventory.icons
    .filter(({ mediaRecovery }) => mediaRecovery === 'required-public-or-cargo')
    .map(({ sourcePath }) => sourcePath);
  assert.deepEqual(sorted(fixtureRecoveryPaths), sorted(recoveryRequiredPaths));
  assert.deepEqual(sorted(publicRecoverySources.map(({ legacyPath }) => legacyPath)), sorted(recoveryRequiredPaths));

  for (const source of publicRecoverySources) {
    const icon = icons.find(({ sourceUrl }) => new URL(sourceUrl).pathname === source.legacyPath);
    const ownedAssets = manifest.filter(({ legacyPath }) => legacyPath === source.legacyPath);
    assert.ok(icon, source.legacyPath);
    assert.ok(source.originals.length > 0, `${source.legacyPath} has no pinned recovery originals`);
    for (const original of source.originals) {
      assert.equal(
        manifest.filter(({ legacyPath, sourceUrl }) => (
          legacyPath === source.legacyPath && sourceUrl === original.sourceUrl
        )).length,
        1,
        `${source.legacyPath} lost pinned recovery asset ${original.sourceUrl}`,
      );
    }
    assert.equal(icon.images.length, ownedAssets.length, source.legacyPath);
    assert.equal(icon.published, ownedAssets.length > 0, source.legacyPath);
    assert.equal(icon.published, true, `${source.legacyPath} has pinned assets and must remain published`);
  }
});

test('asset filenames are deterministic from slug and gallery order', async () => {
  const icons = await loadJson('../../public/content/icons.json');

  for (const icon of icons) {
    icon.images.forEach((image, index) => {
      const file = image.src.split('/').at(-1);
      const stem = file.replace(/\.[^.]+$/u, '');
      assert.equal(stem, index === 0 ? icon.slug : `${icon.slug}-${index + 1}`, image.src);
    });
  }
});

test('durable migration report has stable provenance and verifies icon-owned outputs', async () => {
  const [report, manifest, aliases] = await Promise.all([
    loadJson('../../reports/icon-migration.json'),
    loadJson('../../public/assets/icons/manifest.json'),
    loadJson('../../public/content/aliases.json'),
  ]);
  const serialized = JSON.stringify(report);

  assert.equal(report.schemaVersion, 2);
  assert.deepEqual(report.source, {
    siteUrl: 'https://iconamaster.cargo.site',
    archiveName: 'pre-optimized-publish-20260818',
    inventorySchemaVersion: 2,
  });
  assert.equal('recoveryAttempts' in report, false);
  assert.equal('assetFailures' in report, false);
  assert.doesNotMatch(serialized, /(?:^|["\s])[A-Za-z]:[\\/]/u, 'durable report must not contain host paths');
  assert.deepEqual(report.assets, manifest);

  for (const output of report.outputs) {
    assert.match(output.path, /^(public|reports)\//u);
    if (output.id === 'aliases') {
      assert.ok(Object.keys(aliases).length >= output.records, 'downstream migrations may extend shared aliases');
      continue;
    }
    const bytes = await readFile(new URL(`../../${output.path}`, import.meta.url));
    assert.equal(output.bytes, bytes.length, output.path);
    assert.equal(output.sha256, sha256(bytes), output.path);
  }
  assert.deepEqual(sorted(report.recoveries.map(({ legacyPath }) => legacyPath)), sorted(recoveryRequiredPaths));
  for (const recovery of report.recoveries) {
    assert.ok(recovery.pinnedOriginals.length > 0, recovery.legacyPath);
  }
});
