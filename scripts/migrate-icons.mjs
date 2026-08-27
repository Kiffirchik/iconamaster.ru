import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { legacyIconMap } from './data/legacy-icon-map.mjs';
import { publicRecoverySources, verifiedSources } from './icon-sources.mjs';
import { extractEmbeddedPage, extractMediaEntries } from './lib/legacy-html.mjs';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const contentDirectory = path.join(projectDirectory, 'public', 'content');
const assetDirectory = path.join(projectDirectory, 'public', 'assets', 'icons');
const reportDirectory = path.join(projectDirectory, 'reports');
const iconsPath = path.join(contentDirectory, 'icons.json');
const aliasesPath = path.join(contentDirectory, 'aliases.json');
const manifestPath = path.join(assetDirectory, 'manifest.json');
const reportPath = path.join(reportDirectory, 'icon-migration.json');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sortedUnique = (values) => [...new Set(values)].sort();
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const assertUnique = (label, values) => {
  const duplicates = sortedUnique(values.filter((value, index) => values.indexOf(value) !== index));
  if (duplicates.length > 0) throw new Error(`Duplicate ${label}: ${duplicates.join(', ')}`);
};

const validateInputs = async (sourceDirectory, inventory) => {
  if (inventory.schemaVersion !== 2) {
    throw new Error(`Expected inventory schema version 2, found ${inventory.schemaVersion}`);
  }
  if (legacyIconMap.length !== 50) {
    throw new Error(`Expected 50 legacy map entries, found ${legacyIconMap.length}`);
  }
  if (!Array.isArray(inventory.icons) || inventory.icons.length !== 50) {
    throw new Error(`Expected 50 inventory icons, found ${inventory.icons?.length ?? 'invalid'}`);
  }

  assertUnique('legacy paths', legacyIconMap.map(({ legacyPath }) => legacyPath));
  assertUnique('slugs', legacyIconMap.map(({ slug }) => slug));

  for (const entry of legacyIconMap) {
    for (const field of ['legacyPath', 'slug', 'type', 'period', 'published']) {
      if (!(field in entry)) throw new Error(`Map entry ${entry.legacyPath ?? entry.slug ?? '<unknown>'} lacks ${field}`);
    }
    if (!entry.legacyPath.startsWith('/')) throw new Error(`Legacy path must be root-relative: ${entry.legacyPath}`);
    if (typeof entry.published !== 'boolean') throw new Error(`Map published flag must be boolean: ${entry.legacyPath}`);
  }

  const mappedPaths = legacyIconMap.map(({ legacyPath }) => legacyPath).sort();
  const inventoryPaths = inventory.icons.map(({ sourcePath }) => sourcePath).sort();
  if (JSON.stringify(mappedPaths) !== JSON.stringify(inventoryPaths)) {
    const missing = inventoryPaths.filter((sourcePath) => !mappedPaths.includes(sourcePath));
    const extra = mappedPaths.filter((legacyPath) => !inventoryPaths.includes(legacyPath));
    throw new Error(`Unaccounted catalog links; missing=${missing.join(',')} extra=${extra.join(',')}`);
  }

  for (const icon of inventory.icons) {
    if (!icon.title?.trim()) throw new Error(`Missing title: ${icon.sourcePath}`);
    if (new URL(icon.sourceUrl).pathname !== icon.sourcePath) {
      throw new Error(`Source URL does not match source path: ${icon.sourcePath}`);
    }
    if (icon.localPath) {
      const sourceFile = path.resolve(sourceDirectory, icon.localPath);
      const sourceRoot = `${path.resolve(sourceDirectory)}${path.sep}`;
      if (!sourceFile.startsWith(sourceRoot) || !(await stat(sourceFile)).isFile()) {
        throw new Error(`Inventory source page is missing: ${icon.localPath}`);
      }
    }
  }
};

const jpegDimensions = (bytes) => {
  let offset = 2;
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (startOfFrame.has(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) break;
    offset += length + 2;
  }
  throw new Error('JPEG dimensions are unavailable');
};

const imageDimensions = (bytes) => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegDimensions(bytes);
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/u)) {
    return { width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  throw new Error('Unsupported original image format');
};

const extensionFor = (sourceUrl, contentType, bytes) => {
  const extension = path.extname(new URL(sourceUrl).pathname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.gif'].includes(extension)) return extension;
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('gif')) return '.gif';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return '.jpg';
  throw new Error(`Cannot determine image extension for ${sourceUrl}`);
};

const fetchPublicPage = async (legacyPath, pageUrl) => {
  try {
    const response = await fetch(pageUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'IconamasterContentMigration/1.0' },
    });
    const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
    const result = {
      legacyPath,
      pageUrl,
      resolvedUrl: response.url,
      status: response.status,
      contentType,
    };
    if (!response.ok || !contentType.includes('text/html')) {
      return { ...result, outcome: 'unavailable', originalUrls: [] };
    }

    const html = await response.text();
    const normalizedHtml = html.replaceAll('\\/', '/').replaceAll('&amp;', '&');
    let embedded = null;
    let embeddedError;
    try {
      embedded = extractEmbeddedPage(normalizedHtml, legacyPath);
    } catch (error) {
      embeddedError = error.message;
    }
    const resolvedPath = new URL(response.url).pathname.replace(/\/$/u, '');
    const directMedia = !embedded && resolvedPath === legacyPath
      ? extractMediaEntries(normalizedHtml, 'public-page-html')
      : [];
    const originalUrls = sortedUnique([...(embedded?.media ?? []), ...directMedia]
      .filter(({ role }) => role === 'original')
      .map(({ url }) => url));
    return {
      ...result,
      outcome: originalUrls.length > 0 ? 'originals-found' : 'no-originals-found',
      ...(embeddedError ? { embeddedError } : {}),
      originalUrls,
    };
  } catch (error) {
    return {
      legacyPath,
      pageUrl,
      outcome: 'network-error',
      error: error.message,
      originalUrls: [],
    };
  }
};

const mergeCandidates = (candidates) => {
  const byUrl = new Map();
  for (const candidate of candidates) {
    const current = byUrl.get(candidate.sourceUrl);
    if (!current) {
      byUrl.set(candidate.sourceUrl, { ...candidate, evidence: [candidate.provenance] });
    } else {
      current.evidence = sortedUnique([...current.evidence, candidate.provenance]);
      current.verified ??= candidate.verified;
    }
  }
  return [...byUrl.values()];
};

const readReusableAsset = async (candidate, existingManifestByUrl, legacyPath) => {
  const previous = existingManifestByUrl.get(candidate.sourceUrl);
  const reusablePrevious = previous?.legacyPath === legacyPath ? previous : null;
  const expected = candidate.verified ?? reusablePrevious;
  if (!expected?.file) return null;

  try {
    const bytes = await readFile(path.join(assetDirectory, expected.file));
    const digest = sha256(bytes);
    if (reusablePrevious?.sha256 && reusablePrevious.sha256 !== digest) {
      throw new Error(`Checksum mismatch for existing asset ${expected.file}`);
    }
    const dimensions = imageDimensions(bytes);
    if (expected.width && expected.width !== dimensions.width) {
      throw new Error(`Width mismatch for existing asset ${expected.file}`);
    }
    if (expected.height && expected.height !== dimensions.height) {
      throw new Error(`Height mismatch for existing asset ${expected.file}`);
    }
    return { bytes, digest, dimensions, previous: { ...reusablePrevious, ...expected } };
  } catch (error) {
    if (error.code === 'ENOENT' && !candidate.verified) return null;
    throw error;
  }
};

const fetchOriginal = async (sourceUrl) => {
  const response = await fetch(sourceUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: { 'user-agent': 'IconamasterContentMigration/1.0' },
  });
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!response.ok || !contentType.startsWith('image/')) {
    throw new Error(`HTTP ${response.status}; content-type=${contentType || '<missing>'}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, contentType, resolvedUrl: response.url };
};

const migrateAsset = async ({ candidate, candidateIndex, mapping, source, previousIcon, existingManifestByUrl }) => {
  const reused = await readReusableAsset(candidate, existingManifestByUrl, mapping.legacyPath);
  let bytes;
  let dimensions;
  let contentType = '';
  let resolvedUrl = candidate.sourceUrl;
  let reuse = false;

  if (reused) {
    ({ bytes, dimensions } = reused);
    reuse = true;
  } else {
    const downloaded = await fetchOriginal(candidate.sourceUrl);
    ({ bytes, contentType, resolvedUrl } = downloaded);
    dimensions = imageDimensions(bytes);
  }

  const previous = reused?.previous;
  const extension = candidate.verified?.file
    ? path.extname(candidate.verified.file)
    : extensionFor(candidate.sourceUrl, contentType, bytes);
  const generatedId = candidateIndex === 0 ? `${mapping.slug}-main` : `${mapping.slug}-${candidateIndex + 1}`;
  const file = candidate.verified?.file
    ?? `${mapping.slug}${candidateIndex === 0 ? '' : `-${candidateIndex + 1}`}${extension}`;
  const id = candidate.verified?.id ?? generatedId;
  const digest = sha256(bytes);

  if (!reuse || previous.file !== file) await writeFile(path.join(assetDirectory, file), bytes);

  const oldImage = previousIcon?.images?.find(({ src }) => src === `/assets/icons/${file}`);
  const alt = oldImage?.alt ?? (candidateIndex === 0
    ? `${source.title}, полный вид`
    : `${source.title}, дополнительный вид ${candidateIndex}`);
  const position = mapping.previewPosition ?? oldImage?.position ?? previousIcon?.previewPosition ?? '50% 50%';
  const manifest = {
    id,
    file,
    width: dimensions.width,
    height: dimensions.height,
    sourceUrl: candidate.sourceUrl,
    bytes: bytes.length,
    sha256: digest,
    legacyPath: mapping.legacyPath,
    role: 'original',
    provenance: candidate.provenance,
    evidence: candidate.evidence,
  };
  const image = {
    src: `/assets/icons/${file}`,
    alt,
    width: dimensions.width,
    height: dimensions.height,
    fit: 'contain',
    position,
  };
  const attempt = {
    sourceUrl: candidate.sourceUrl,
    resolvedUrl,
    outcome: reuse ? 'reused-verified-bytes' : 'downloaded-original-bytes',
    file,
    bytes: bytes.length,
    sha256: digest,
  };
  return { manifest, image, attempt };
};

const main = async () => {
  const sourceArgument = argument('--source');
  const inventoryArgument = argument('--inventory');
  if (!sourceArgument || !inventoryArgument) {
    throw new Error('Usage: node scripts/migrate-icons.mjs --source <archive-directory> --inventory <inventory-json>');
  }

  const sourceDirectory = path.resolve(sourceArgument);
  const inventoryPath = path.resolve(inventoryArgument);
  if (!(await stat(sourceDirectory)).isDirectory()) {
    throw new Error(`Source is not a directory: ${sourceDirectory}`);
  }
  const inventory = await readJson(inventoryPath);
  await validateInputs(sourceDirectory, inventory);

  const [existingIcons, existingAliases, existingManifest] = await Promise.all([
    readJson(iconsPath),
    readJson(aliasesPath),
    readJson(manifestPath),
  ]);
  const existingIconsBySlug = new Map(existingIcons.map((icon) => [icon.slug, icon]));
  const existingManifestByUrl = new Map(existingManifest.map((asset) => [asset.sourceUrl, asset]));
  const inventoryByPath = new Map(inventory.icons.map((icon) => [icon.sourcePath, icon]));
  const recoveryByPath = new Map(publicRecoverySources.map((source) => [source.legacyPath, {
    legacyPath: source.legacyPath,
    provenOriginalUrls: source.originals.map(({ sourceUrl }) => sourceUrl),
    pageAttempts: [],
    originalAttempts: [],
    recoveredAssets: [],
  }]));

  for (const recoverySource of publicRecoverySources) {
    const recovery = recoveryByPath.get(recoverySource.legacyPath);
    for (const pageUrl of recoverySource.pageUrls) {
      recovery.pageAttempts.push(await fetchPublicPage(recoverySource.legacyPath, pageUrl));
    }
  }

  await mkdir(assetDirectory, { recursive: true });
  await mkdir(reportDirectory, { recursive: true });
  const icons = [];
  const manifest = [];
  const assetFailures = [];

  for (const [orderIndex, mapping] of legacyIconMap.entries()) {
    const source = inventoryByPath.get(mapping.legacyPath);
    const previousIcon = existingIconsBySlug.get(mapping.slug);
    const recoverySource = publicRecoverySources.find(({ legacyPath }) => legacyPath === mapping.legacyPath);
    const recovery = recoveryByPath.get(mapping.legacyPath);
    const candidates = mergeCandidates([
      ...verifiedSources
        .filter(({ legacyPath }) => legacyPath === mapping.legacyPath)
        .map((verified) => ({
          sourceUrl: verified.sourceUrl,
          provenance: 'verified-existing-original',
          verified,
        })),
      ...source.media
        .filter(({ role }) => role === 'original')
        .map((media) => ({
          sourceUrl: media.url,
          provenance: media.provenance,
        })),
      ...(recoverySource?.originals ?? []),
    ]);

    const migratedAssets = [];
    for (const [candidateIndex, candidate] of candidates.entries()) {
      try {
        const migrated = await migrateAsset({
          candidate,
          candidateIndex,
          mapping,
          source,
          previousIcon,
          existingManifestByUrl,
        });
        migratedAssets.push(migrated);
        if (recovery) recovery.originalAttempts.push(migrated.attempt);
      } catch (error) {
        const failure = {
          legacyPath: mapping.legacyPath,
          sourceUrl: candidate.sourceUrl,
          outcome: 'unavailable',
          error: error.message,
        };
        assetFailures.push(failure);
        if (recovery) recovery.originalAttempts.push(failure);
      }
    }

    const images = migratedAssets.map(({ image }) => image);
    manifest.push(...migratedAssets.map(({ manifest: asset }) => asset));
    if (recovery) recovery.recoveredAssets = migratedAssets.map(({ manifest: asset }) => asset.file);
    const fields = ['availability', 'size', 'technique', 'origin', 'condition', 'expertise', 'description'];
    const retained = Object.fromEntries(fields.map((field) => [field, previousIcon?.[field] ?? '']));
    icons.push({
      id: previousIcon?.id ?? mapping.slug,
      slug: mapping.slug,
      title: source.title,
      published: Boolean(mapping.published && images.length > 0),
      ...retained,
      price: previousIcon?.price ?? null,
      order: orderIndex + 1,
      type: mapping.type,
      period: mapping.period,
      sourceUrl: source.sourceUrl,
      images,
      previewFit: 'contain',
      previewPosition: mapping.previewPosition ?? previousIcon?.previewPosition ?? '50% 50%',
    });
  }

  const aliases = Object.fromEntries(Object.entries({
    ...existingAliases,
    ...Object.fromEntries(legacyIconMap.map(({ legacyPath, slug }) => [legacyPath, `/icons/${slug}`])),
  }).sort(([left], [right]) => left.localeCompare(right)));
  manifest.sort((left, right) => left.id.localeCompare(right.id));

  const unpublishedRecords = icons.filter(({ published }) => !published).map((icon) => ({
    legacyPath: new URL(icon.sourceUrl).pathname,
    slug: icon.slug,
    reason: 'No trustworthy original was recovered',
  }));
  for (const recovery of recoveryByPath.values()) {
    recovery.published = !unpublishedRecords.some(({ legacyPath }) => legacyPath === recovery.legacyPath);
  }
  const report = {
    schemaVersion: 1,
    source: {
      archive: sourceDirectory,
      inventory: inventoryPath,
      inventorySchemaVersion: inventory.schemaVersion,
    },
    summary: {
      mappedRecords: icons.length,
      uniqueSlugs: new Set(icons.map(({ slug }) => slug)).size,
      publishedRecords: icons.filter(({ published }) => published).length,
      unpublishedRecords: unpublishedRecords.length,
      assetFiles: manifest.length,
      assetBytes: manifest.reduce((total, asset) => total + asset.bytes, 0),
      recoveredRequiredRecords: [...recoveryByPath.values()].filter(({ published }) => published).length,
      unresolvedRecoveryRecords: [...recoveryByPath.values()].filter(({ published }) => !published).length,
      assetFailures: assetFailures.length,
    },
    checksumPolicy: 'Every local original is copied or downloaded without decoding or re-encoding, then recorded with its byte length and SHA-256 digest.',
    thumbnailPolicy: 'Catalog thumbnail URLs are evidence only. Migration uses Cargo t/original endpoints or page-proven original URLs and never stores thumbnail bytes as originals.',
    recoveryAttempts: [...recoveryByPath.values()],
    assetFailures,
    unpublishedRecords,
    records: icons.map(({ slug, title, published, sourceUrl, images }) => ({
      legacyPath: new URL(sourceUrl).pathname,
      slug,
      title,
      sourceUrl,
      published,
      assetFiles: images.map(({ src }) => path.basename(src)),
    })),
  };

  await Promise.all([
    writeFile(iconsPath, json(icons), 'utf8'),
    writeFile(aliasesPath, json(aliases), 'utf8'),
    writeFile(manifestPath, json(manifest), 'utf8'),
    writeFile(reportPath, json(report), 'utf8'),
  ]);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Migration report written to ${reportPath}`);
};

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
