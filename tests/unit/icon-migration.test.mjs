import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { publicRecoverySources } from '../../scripts/icon-sources.mjs';

const loadJson = async (relativePath) => JSON.parse(await readFile(
  new URL(relativePath, import.meta.url),
));

test('catalog migration contains all 50 source records and no duplicate slugs', async () => {
  const icons = JSON.parse(await readFile(new URL('../../public/content/icons.json', import.meta.url)));
  assert.equal(icons.length, 50);
  assert.equal(new Set(icons.map(({ slug }) => slug)).size, 50);
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

test('every inventory record keeps its source title and root-relative legacy alias', async () => {
  const [inventory, icons, aliases] = await Promise.all([
    loadJson('../../tmp/migration-inventory.json'),
    loadJson('../../public/content/icons.json'),
    loadJson('../../public/content/aliases.json'),
  ]);
  const iconsBySourceUrl = new Map(icons.map((icon) => [icon.sourceUrl, icon]));

  assert.equal(inventory.schemaVersion, 2);
  for (const source of inventory.icons) {
    const icon = iconsBySourceUrl.get(source.sourceUrl);
    assert.ok(icon, source.sourcePath);
    assert.equal(icon.title, source.title);
    assert.equal(aliases[source.sourcePath], `/icons/${icon.slug}`);
    assert.match(aliases[source.sourcePath], /^\//);
  }
});

test('unpublished records have no images and every migrated image has manifest provenance', async () => {
  const [icons, manifest] = await Promise.all([
    loadJson('../../public/content/icons.json'),
    loadJson('../../public/assets/icons/manifest.json'),
  ]);
  const assetsByPath = new Map(manifest.map((asset) => [`/assets/icons/${asset.file}`, asset]));

  for (const icon of icons) {
    if (!icon.published) assert.deepEqual(icon.images, [], icon.slug);
    for (const image of icon.images) {
      const asset = assetsByPath.get(image.src);
      assert.ok(asset, `${icon.slug}: ${image.src}`);
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
      assert.equal(asset.legacyPath, new URL(icon.sourceUrl).pathname);
      assert.notEqual(asset.provenance, 'catalog-card-thumbnail');
    }
  }
});

test('public recovery never assigns another inventory record original', async () => {
  const [inventory, manifest] = await Promise.all([
    loadJson('../../tmp/migration-inventory.json'),
    loadJson('../../public/assets/icons/manifest.json'),
  ]);
  const inventoryOwnerByOriginal = new Map(inventory.icons.flatMap((icon) => icon.media
    .filter(({ role }) => role === 'original')
    .map(({ url }) => [url, icon.sourcePath])));

  for (const asset of manifest) {
    const inventoryOwner = inventoryOwnerByOriginal.get(asset.sourceUrl);
    if (inventoryOwner) assert.equal(asset.legacyPath, inventoryOwner, asset.sourceUrl);
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

test('every recovered original is pinned to its proven public source path', async () => {
  const manifest = await loadJson('../../public/assets/icons/manifest.json');
  const recoveryByPath = new Map(publicRecoverySources.map((source) => [
    source.legacyPath,
    new Set((source.originals ?? []).map(({ sourceUrl }) => sourceUrl)),
  ]));

  for (const asset of manifest.filter(({ legacyPath, provenance }) => (
    recoveryByPath.has(legacyPath) && provenance !== 'verified-existing-original'
  ))) {
    assert.ok(recoveryByPath.get(asset.legacyPath).has(asset.sourceUrl), asset.sourceUrl);
  }
});
