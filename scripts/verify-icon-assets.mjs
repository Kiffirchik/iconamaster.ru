import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { publicRecoverySources, verifiedSources } from './icon-sources.mjs';
import { legacyIconMap } from './data/legacy-icon-map.mjs';

const sorted = (values) => [...values].sort();
const compareCodeUnits = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function isContained(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function sha256File(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function verifyIconAssetSet({ assetDirectory, manifest, allowedOwners }) {
  const errors = [];
  if (!Array.isArray(manifest)) return ['icon manifest must be an array'];

  let rootMetadata;
  try {
    rootMetadata = await lstat(assetDirectory);
  } catch {
    return ['icon asset root must be a real directory'];
  }
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
    return ['icon asset root must be a real directory'];
  }
  const rootRealPath = await realpath(assetDirectory);

  const manifestFiles = new Set();
  const manifestSources = new Set();
  const entries = (await readdir(assetDirectory, { withFileTypes: true }))
    .sort((left, right) => compareCodeUnits(left.name, right.name));
  const diskFiles = new Set();
  for (const entry of entries) {
    const absolute = path.join(assetDirectory, entry.name);
    const metadata = await lstat(absolute);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
      errors.push(`icon asset directory contains a non-file: ${entry.name}`);
      continue;
    }
    const resolved = await realpath(absolute);
    if (!isContained(rootRealPath, resolved)) {
      errors.push(`icon asset resolves outside asset root: ${entry.name}`);
      continue;
    }
    if (entry.name !== 'manifest.json') diskFiles.add(entry.name);
  }

  for (const asset of manifest) {
    const file = asset?.file;
    if (typeof file !== 'string' || path.basename(file) !== file || !/\.(?:jpe?g|png|webp)$/iu.test(file)) {
      errors.push(`manifest has unsafe icon filename: ${file ?? '<missing>'}`);
      continue;
    }
    if (manifestFiles.has(file)) errors.push(`manifest repeats icon filename: ${file}`);
    manifestFiles.add(file);

    if (manifestSources.has(asset.sourceUrl)) errors.push(`manifest repeats icon source: ${asset.sourceUrl}`);
    manifestSources.add(asset.sourceUrl);
    if (!allowedOwners.has(asset.sourceUrl)) {
      errors.push(`manifest source has no independent owner: ${asset.sourceUrl}`);
    } else if (allowedOwners.get(asset.sourceUrl) !== asset.legacyPath) {
      errors.push(`manifest source owner mismatch: ${asset.sourceUrl}`);
    }
    if (asset.role !== 'original' || typeof asset.provenance !== 'string' || !asset.provenance) {
      errors.push(`manifest original provenance is invalid: ${file}`);
    }
    if (!Number.isInteger(asset.width) || asset.width <= 0 || !Number.isInteger(asset.height) || asset.height <= 0) {
      errors.push(`manifest dimensions are invalid: ${file}`);
    }
    if (!Number.isInteger(asset.bytes) || asset.bytes <= 0 || !/^[a-f0-9]{64}$/u.test(asset.sha256 ?? '')) {
      errors.push(`manifest stat/hash metadata is invalid: ${file}`);
    }

    const absolute = path.join(assetDirectory, file);
    if (!diskFiles.has(file)) {
      errors.push(`original asset is missing: ${file}`);
      continue;
    }
    const stat = await lstat(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      errors.push(`original asset is not a regular file: ${file}`);
      continue;
    }
    if (stat.size !== asset.bytes) {
      errors.push(`original asset byte count mismatch: ${file}`);
      continue;
    }
    if (await sha256File(absolute) !== asset.sha256) errors.push(`original asset checksum mismatch: ${file}`);
  }

  for (const [sourceUrl] of allowedOwners) {
    if (!manifestSources.has(sourceUrl)) errors.push(`independently owned source is missing from manifest: ${sourceUrl}`);
  }
  for (const file of sorted(diskFiles)) {
    if (!manifestFiles.has(file)) errors.push(`stale icon asset file is not in the manifest: ${file}`);
  }
  return errors;
}

function buildAllowedOwners(inventory, errors) {
  const ownersBySource = new Map();
  const add = (sourceUrl, legacyPath) => {
    const owners = ownersBySource.get(sourceUrl) ?? new Set();
    owners.add(legacyPath);
    ownersBySource.set(sourceUrl, owners);
  };
  for (const icon of inventory.icons ?? []) {
    for (const original of icon.originals ?? []) add(original.sourceUrl, icon.sourcePath);
  }
  for (const source of verifiedSources) add(source.sourceUrl, source.legacyPath);
  for (const source of publicRecoverySources) {
    for (const original of source.originals) add(original.sourceUrl, source.legacyPath);
  }

  const allowed = new Map();
  for (const [sourceUrl, owners] of ownersBySource) {
    if (owners.size !== 1) {
      errors.push(`independent fixtures assign multiple owners to ${sourceUrl}`);
    } else {
      allowed.set(sourceUrl, [...owners][0]);
    }
  }
  return allowed;
}

function validateContentOwnership(icons, manifest, errors) {
  const manifestByFile = new Map(manifest.map((asset) => [asset.file, asset]));
  const referenced = new Set();
  for (const icon of icons) {
    const images = Array.isArray(icon.images) ? icon.images : [];
    if (icon.published && images.length === 0) errors.push(`published icon has no originals: ${icon.slug}`);
    if (!icon.published && images.length > 0) errors.push(`unpublished icon owns public originals: ${icon.slug}`);
    let sourcePath;
    try {
      sourcePath = new URL(icon.sourceUrl).pathname;
    } catch {
      errors.push(`icon source URL is invalid: ${icon.slug}`);
    }
    for (const image of images) {
      if (typeof image.src !== 'string' || !image.src.startsWith('/assets/icons/')) {
        errors.push(`icon image is not an owned local original: ${icon.slug}`);
        continue;
      }
      const file = image.src.slice('/assets/icons/'.length);
      if (!file || path.basename(file) !== file) {
        errors.push(`icon image path is unsafe: ${image.src}`);
        continue;
      }
      if (referenced.has(file)) errors.push(`icon original is referenced more than once: ${file}`);
      referenced.add(file);
      const asset = manifestByFile.get(file);
      if (!asset) {
        errors.push(`icon image is absent from manifest: ${image.src}`);
        continue;
      }
      if (asset.legacyPath !== sourcePath) errors.push(`icon image owner mismatch: ${image.src}`);
      if (asset.width !== image.width || asset.height !== image.height) errors.push(`icon image dimensions drifted: ${image.src}`);
      if (typeof image.alt !== 'string' || !image.alt.trim()) errors.push(`icon image alt text is empty: ${image.src}`);
    }
  }
  for (const { file } of manifest) {
    if (!referenced.has(file)) errors.push(`manifest original is unreferenced by icon content: ${file}`);
  }
}

export async function verifyIconAssetProject(projectRoot = new URL('../', import.meta.url)) {
  const projectDirectory = projectRoot instanceof URL ? fileURLToPath(projectRoot) : path.resolve(projectRoot);
  const assetDirectory = path.join(projectDirectory, 'public', 'assets', 'icons');
  let rootMetadata;
  try {
    rootMetadata = await lstat(assetDirectory);
  } catch {
    rootMetadata = null;
  }
  if (!rootMetadata?.isDirectory() || rootMetadata.isSymbolicLink()) {
    return {
      errors: ['icon asset root must be a real directory'],
      summary: { assets: 0, bytes: 0, independentOwners: 0 },
    };
  }
  const rootRealPath = await realpath(assetDirectory);
  const manifestPath = path.join(assetDirectory, 'manifest.json');
  let manifestMetadata;
  try {
    manifestMetadata = await lstat(manifestPath);
  } catch {
    manifestMetadata = null;
  }
  if (!manifestMetadata?.isFile() || manifestMetadata.isSymbolicLink()
    || !isContained(rootRealPath, await realpath(manifestPath))) {
    return {
      errors: ['icon asset manifest must be a real contained file'],
      summary: { assets: 0, bytes: 0, independentOwners: 0 },
    };
  }
  const [manifest, inventory, icons] = await Promise.all([
    readFile(path.join(assetDirectory, 'manifest.json'), 'utf8').then(JSON.parse),
    readFile(path.join(projectDirectory, 'tests', 'fixtures', 'migration', 'icon-inventory.json'), 'utf8').then(JSON.parse),
    readFile(path.join(projectDirectory, 'public', 'content', 'icons.json'), 'utf8').then(JSON.parse),
  ]);
  const errors = [];
  if (inventory.schemaVersion !== 2 || !Array.isArray(inventory.icons)) {
    errors.push('independent icon inventory must use schema version 2');
  }
  const fixturePaths = sorted((inventory.icons ?? []).map(({ sourcePath }) => sourcePath));
  const mappedPaths = sorted(legacyIconMap.map(({ legacyPath }) => legacyPath));
  if (JSON.stringify(fixturePaths) !== JSON.stringify(mappedPaths)) {
    errors.push('independent icon inventory and source map paths differ');
  }
  const allowedOwners = buildAllowedOwners(inventory, errors);
  errors.push(...await verifyIconAssetSet({ assetDirectory, manifest, allowedOwners }));
  validateContentOwnership(icons, manifest, errors);
  return {
    errors,
    summary: {
      assets: manifest.length,
      bytes: manifest.reduce((total, asset) => total + (asset.bytes ?? 0), 0),
      independentOwners: allowedOwners.size,
    },
  };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const result = await verifyIconAssetProject(process.argv[2] ?? new URL('../', import.meta.url));
    if (result.errors.length > 0) {
      console.error(`icon asset verification failed with ${result.errors.length} error(s):`);
      for (const error of result.errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      console.log(
        `verified ${result.summary.assets} independently owned original icon assets `
        + `(${result.summary.bytes} bytes) with streaming SHA-256`,
      );
    }
  } catch (error) {
    console.error(`icon asset verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
