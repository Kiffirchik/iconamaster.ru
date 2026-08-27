import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { legacyArticleMap } from './data/legacy-article-map.mjs';
import { legacyIconMap } from './data/legacy-icon-map.mjs';
import { legacyPageMap } from './data/legacy-page-map.mjs';
import { parseRoute } from '../src/lib/routing.js';

const CONTENT_DOCUMENTS = ['icons', 'pages', 'articles', 'videos', 'contacts', 'aliases'];
const CANONICAL_CONTACTS = {
  whatsapp: '79166554595',
  phone: '+79166554595',
  email: 'iconamaster@yandex.ru',
};
const STATIC_ALIASES = {
  '/IKONY': '/collection',
  '/IKONY-V-NALICIE': '/collection',
  '/KONTAKTY': '/contacts',
  '/STAT-I': '/articles',
  '/VIDEO': '/video',
};
const EXCLUDED_ARTICLE_PATH = '/IKONY-V-OKLADAK-TRADITIY-I-ISTORIY';
const RAW_HTML = /<(?:\/?[A-Za-z][^>]*|!DOCTYPE[^>]*)>/iu;
const EXECUTABLE_TEXT = /(?:javascript\s*:|\bon[a-z]+\s*=)/iu;

const sorted = (values) => [...values].sort();
const ownerKey = (type, slug) => `${type}:${slug}`;

function decodedAssetPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/assets/') || value.startsWith('//')) return null;
  if (/[\\?#\0]/u.test(value)) return null;

  let decoded = value;
  try {
    for (let index = 0; index < 4; index += 1) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return null;
  }

  if (!decoded.startsWith('/assets/') || decoded.startsWith('//') || /[\\?#\0]/u.test(decoded)) return null;
  if (/%[0-9a-f]{2}/iu.test(decoded)) return null;
  if (decoded.split('/').some((segment, index) => index > 0 && !segment)) return null;
  if (decoded.split('/').some((segment) => segment === '.' || segment === '..')) return null;
  if (path.posix.normalize(decoded) !== decoded) return null;
  return decoded;
}

export function resolvePublicAssetPath(publicDirectory, assetUrl) {
  const normalized = decodedAssetPath(assetUrl);
  if (!normalized) throw new Error(`invalid asset path ${assetUrl}`);
  const publicPath = path.resolve(publicDirectory);
  const candidate = path.resolve(publicPath, `.${normalized}`);
  const relative = path.relative(publicPath, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`asset path escapes public directory: ${assetUrl}`);
  }
  return candidate;
}

function validateImage(image, label, assetFiles, errors, referencedFiles, missingLabel = label) {
  if (!image || typeof image !== 'object' || Array.isArray(image)) return false;
  let usable = true;
  const source = decodedAssetPath(image.src);
  if (!source) {
    errors.push(`${label} has invalid asset path ${image.src ?? '<missing>'}`);
    usable = false;
  } else {
    referencedFiles.add(source);
    if (!assetFiles.has(source)) errors.push(`${missingLabel} references missing ${source}`);
  }
  if (typeof image.alt !== 'string' || !image.alt.trim()) {
    errors.push(`${label} requires non-empty alt text`);
    usable = false;
  }
  if (!Number.isInteger(image.width) || image.width <= 0 || !Number.isInteger(image.height) || image.height <= 0) {
    errors.push(`${label} has invalid dimensions ${image.width ?? '<missing>'}x${image.height ?? '<missing>'}`);
    usable = false;
  }
  return usable;
}

function validateBlocks(sections, label, assetFiles, errors, referencedFiles) {
  if (!Array.isArray(sections)) {
    errors.push(`${label} sections must be an array`);
    return;
  }

  const seen = new WeakSet();
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);

    if (Object.hasOwn(value, 'type')) {
      if (value.type === 'text') {
        const hasHeading = typeof value.heading === 'string' && Boolean(value.heading.trim());
        const hasParagraph = Array.isArray(value.paragraphs)
          && value.paragraphs.some((paragraph) => typeof paragraph === 'string' && Boolean(paragraph.trim()));
        if (!hasHeading && !hasParagraph) errors.push(`${label} contains an empty text block`);
      } else if (value.type === 'image') {
        if (!value.image) {
          errors.push(`${label} contains an empty image block`);
        } else {
          validateImage(value.image, `${label} image block`, assetFiles, errors, referencedFiles);
        }
      } else if (value.type === 'gallery') {
        if (!Array.isArray(value.images) || value.images.length === 0) {
          errors.push(`${label} contains an empty gallery block`);
        } else {
          value.images.forEach((image, index) => {
            validateImage(image, `${label} gallery image ${index + 1}`, assetFiles, errors, referencedFiles);
          });
        }
      } else {
        errors.push(`${label} contains unsupported block type ${value.type ?? '<missing>'}`);
      }
    }

    for (const nested of Object.values(value)) visit(nested);
  };
  visit(sections);
}

function containsPolicyViolation(value, predicate, seen = new WeakSet()) {
  if (typeof value === 'string') return predicate(value);
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsPolicyViolation(item, predicate, seen));
  return Object.values(value).some((item) => containsPolicyViolation(item, predicate, seen));
}

function enablesAutoplay(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (!Array.isArray(value) && value.autoplay === true) return true;
  return Object.values(value).some((item) => enablesAutoplay(item, seen));
}

function validateOwnerPolicies(record, label, errors) {
  if (containsPolicyViolation(record, (value) => RAW_HTML.test(value) || EXECUTABLE_TEXT.test(value))) {
    errors.push(`${label} contains raw executable HTML`);
  }
  if (enablesAutoplay(record)) errors.push(`${label} enables autoplay`);
}

function validateDuplicateSlugs(collection, label, errors) {
  const seen = new Set();
  const singular = label.slice(0, -1);
  for (const record of collection) {
    if (typeof record?.slug !== 'string' || !record.slug.trim()) {
      errors.push(`${singular} slug is required`);
      continue;
    }
    if (seen.has(record.slug)) errors.push(`duplicate ${singular} slug ${record.slug}`);
    seen.add(record.slug);
  }
}

function isRootRelativeRoute(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return false;
  if (/[\\?#\0]/u.test(value)) return false;
  try {
    const decoded = decodeURI(value);
    return decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.split('/').includes('..');
  } catch {
    return false;
  }
}

function validateAliases(bundle, errors) {
  const aliases = bundle?.aliases;
  if (!aliases || typeof aliases !== 'object' || Array.isArray(aliases)) {
    errors.push('aliases must be an object');
    return;
  }

  const keys = sorted(Object.keys(aliases));
  const loopMembers = new Set();
  const reportedCycles = new Set();
  for (const start of keys) {
    const positions = new Map();
    const chain = [];
    let current = start;
    while (Object.hasOwn(aliases, current)) {
      if (positions.has(current)) {
        const cycle = [...chain.slice(positions.get(current)), current];
        const signature = sorted(new Set(cycle)).join('\0');
        if (!reportedCycles.has(signature)) {
          errors.push(`alias loop detected: ${cycle.join(' -> ')}`);
          reportedCycles.add(signature);
        }
        cycle.forEach((item) => loopMembers.add(item));
        break;
      }
      positions.set(current, chain.length);
      chain.push(current);
      current = aliases[current];
      if (typeof current !== 'string') break;
    }
  }

  const iconSlugs = new Set(bundle.icons.map(({ slug }) => slug));
  const articleSlugs = new Set(bundle.articles.map(({ slug }) => slug));
  const pageSlugs = new Set(bundle.pages.map(({ slug }) => slug));
  for (const alias of keys) {
    const target = aliases[alias];
    if (!isRootRelativeRoute(alias)) {
      errors.push(`alias path must be root-relative: ${alias}`);
      continue;
    }
    if (!isRootRelativeRoute(target)) {
      errors.push(`alias ${alias} target must be root-relative: ${target}`);
      continue;
    }
    if (loopMembers.has(alias)) continue;
    if (Object.hasOwn(aliases, target)) {
      errors.push(`alias ${alias} target must be canonical: ${target}`);
      continue;
    }

    let route;
    try {
      route = parseRoute(target, {});
      parseRoute(alias, aliases);
    } catch {
      errors.push(`alias ${alias} has malformed target ${target}`);
      continue;
    }
    if (route.name === 'not-found') errors.push(`alias ${alias} has unrecognized target ${target}`);
    if (route.name === 'icon' && !iconSlugs.has(route.slug)) errors.push(`alias ${alias} targets missing icon ${route.slug}`);
    if (route.name === 'article' && !articleSlugs.has(route.slug)) errors.push(`alias ${alias} targets missing article ${route.slug}`);
    if (route.name === 'page' && !pageSlugs.has(route.slug)) errors.push(`alias ${alias} targets missing page ${route.slug}`);
  }
}

function validateExpectedSet(label, actualValues, expectedValues, errors) {
  if (!Array.isArray(expectedValues)) return;
  const actual = new Set(actualValues);
  const expected = new Set(expectedValues);
  const noun = label === 'videos' ? '' : 'slug ';
  for (const value of sorted(expected)) {
    if (!actual.has(value)) errors.push(`${label} contract is missing ${noun}${value}`);
  }
  for (const value of sorted(actual)) {
    if (!expected.has(value)) errors.push(`${label} contract has unexpected ${noun}${value}`);
  }
}

function validateExpectedContract(bundle, expected, errors) {
  if (!expected) return;
  validateExpectedSet('icons', bundle.icons.map(({ slug }) => slug), expected.icons, errors);
  validateExpectedSet('pages', bundle.pages.map(({ slug }) => slug), expected.pages, errors);
  validateExpectedSet('articles', bundle.articles.map(({ slug }) => slug), expected.articles, errors);
  validateExpectedSet('videos', bundle.videos.map(({ provider, id }) => `${provider}:${id}`), expected.videos, errors);

  for (const [alias, target] of Object.entries(expected.aliases ?? {})) {
    if (bundle.aliases[alias] === undefined) errors.push(`aliases contract is missing ${alias}`);
    else if (bundle.aliases[alias] !== target) errors.push(`alias ${alias} must target ${target}`);
  }
  const expectedAliasKeys = Object.keys(expected.aliases ?? {});
  if (expectedAliasKeys.length > 0) {
    for (const alias of sorted(Object.keys(bundle.aliases))) {
      if (!Object.hasOwn(expected.aliases, alias)) errors.push(`aliases contract has unexpected ${alias}`);
    }
  }
  for (const excluded of expected.excludedAliases ?? []) {
    if (Object.hasOwn(bundle.aliases, excluded)) errors.push(`excluded source path is aliased: ${excluded}`);
  }
  for (const excluded of expected.excludedSourcePaths ?? []) {
    const included = [...bundle.articles, ...bundle.pages].some(({ sourceUrl }) => {
      try {
        return new URL(sourceUrl).pathname === excluded;
      } catch {
        return false;
      }
    });
    if (included) errors.push(`excluded source path is published: ${excluded}`);
  }
}

export function verifyContent(bundle, assetFiles = new Set(), options = {}) {
  const errors = [];
  const referencedFiles = options.referencedFiles ?? new Set();
  if (bundle?.version !== 1) errors.push('content version must be 1');
  for (const key of ['icons', 'pages', 'articles', 'videos']) {
    if (!Array.isArray(bundle?.[key])) errors.push(`${key} must be an array`);
  }
  const safeBundle = {
    ...bundle,
    icons: Array.isArray(bundle?.icons) ? bundle.icons : [],
    pages: Array.isArray(bundle?.pages) ? bundle.pages : [],
    articles: Array.isArray(bundle?.articles) ? bundle.articles : [],
    videos: Array.isArray(bundle?.videos) ? bundle.videos : [],
    aliases: bundle?.aliases && typeof bundle.aliases === 'object' && !Array.isArray(bundle.aliases)
      ? bundle.aliases
      : {},
  };

  validateDuplicateSlugs(safeBundle.icons, 'icons', errors);
  validateDuplicateSlugs(safeBundle.pages, 'pages', errors);
  validateDuplicateSlugs(safeBundle.articles, 'articles', errors);

  for (const icon of safeBundle.icons) {
    const images = Array.isArray(icon?.images) ? icon.images : [];
    const usability = images.map((image, index) => validateImage(
      image,
      `icon ${icon.slug} image ${index + 1}`,
      assetFiles,
      errors,
      referencedFiles,
      `${icon.published ? 'published ' : ''}icon ${icon.slug}`,
    ));
    if (icon?.published && !usability.some(Boolean)) errors.push(`published icon ${icon.slug} has no usable images`);
    validateOwnerPolicies(icon, `icon ${icon.slug}`, errors);
  }

  for (const [kind, records] of [['page', safeBundle.pages], ['article', safeBundle.articles]]) {
    for (const record of records) {
      const label = `${kind} ${record.slug}`;
      if (kind === 'article' && record.image) {
        validateImage(record.image, `${label} cover`, assetFiles, errors, referencedFiles);
      }
      validateBlocks(record.sections, label, assetFiles, errors, referencedFiles);
      validateOwnerPolicies(record, label, errors);
    }
  }

  for (const video of safeBundle.videos) {
    const label = `video ${video.provider ?? '<missing>'}:${video.id ?? '<missing>'}`;
    if (video.autoplay !== false) errors.push(`${label} must set autoplay to false`);
    validateOwnerPolicies(video, label, errors);
  }

  for (const [key, expected] of Object.entries(CANONICAL_CONTACTS)) {
    if (bundle?.contacts?.[key] !== expected) errors.push(`contacts.${key} must be ${expected}`);
  }
  validateOwnerPolicies(bundle?.contacts, 'contacts', errors);
  validateAliases(safeBundle, errors);
  validateExpectedContract(safeBundle, options.expected, errors);
  return errors;
}

export function verifyOwnedAssetInventory({ diskFiles, referencedFiles, ownedFiles }) {
  const errors = [];
  for (const file of sorted(ownedFiles)) {
    if (!diskFiles.has(file)) errors.push(`owned asset is missing from disk: ${file}`);
  }
  for (const file of sorted(ownedFiles)) {
    if (diskFiles.has(file) && !referencedFiles.has(file)) errors.push(`owned asset is unreferenced: ${file}`);
  }
  for (const file of sorted(diskFiles)) {
    if (!ownedFiles.has(file) && !referencedFiles.has(file)) errors.push(`stale asset file is not owned: ${file}`);
  }
  for (const file of sorted(referencedFiles)) {
    if (!ownedFiles.has(file)) errors.push(`referenced asset is not in the ownership inventory: ${file}`);
  }
  return errors;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function collectFiles(directory, publicDirectory, errors) {
  const files = new Set();
  const publicRealPath = await realpath(publicDirectory);
  const walk = async (current) => {
    const entries = (await readdir(current, { withFileTypes: true })).sort((left, right) => (
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    ));
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        errors.push(`asset inventory contains a symbolic link: ${absolute}`);
      } else if (entry.isDirectory()) {
        await walk(absolute);
      } else {
        const metadata = await lstat(absolute);
        if (!metadata.isFile()) {
          errors.push(`asset inventory contains a non-file: ${absolute}`);
          continue;
        }
        const resolved = await realpath(absolute);
        const relativeReal = path.relative(publicRealPath, resolved);
        if (relativeReal.startsWith('..') || path.isAbsolute(relativeReal)) {
          errors.push(`asset resolves outside public: ${absolute}`);
          continue;
        }
        files.add(`/${path.relative(publicDirectory, absolute).split(path.sep).join('/')}`);
      }
    }
  };
  await walk(directory);
  return files;
}

function expectedAliases() {
  return {
    ...STATIC_ALIASES,
    ...Object.fromEntries(legacyIconMap.map(({ legacyPath, slug }) => [legacyPath, `/icons/${slug}`])),
    ...Object.fromEntries(legacyPageMap.flatMap(({ aliases, slug }) => aliases.map((alias) => [alias, `/${slug}`]))),
    ...Object.fromEntries(legacyArticleMap.flatMap(({ aliases, slug }) => aliases.map((alias) => [alias, `/articles/${slug}`]))),
  };
}

function validateSourceOwnershipFixture(report, fixture, errors) {
  if (fixture?.schemaVersion !== 1 || !Array.isArray(fixture.records)) {
    errors.push('editorial source ownership fixture must use schema version 1');
    return;
  }
  const byOwner = new Map(fixture.records.map((record) => [ownerKey(record.ownerType, record.ownerSlug), record]));
  const actualByOwner = new Map([...byOwner.keys()].map((key) => [key, []]));
  const ownersByIdentity = new Map();
  for (const asset of report.assets ?? []) {
    const key = ownerKey(asset.ownerType, asset.ownerSlug);
    if (!actualByOwner.has(key)) {
      errors.push(`editorial asset has no fixture owner: ${asset.src}`);
      continue;
    }
    actualByOwner.get(key).push(asset);
    for (const identity of [`sourceRef:${asset.sourceRef}`, `sha256:${asset.sha256}`]) {
      const owners = ownersByIdentity.get(identity) ?? new Set();
      owners.add(key);
      ownersByIdentity.set(identity, owners);
    }
  }
  const allowlist = new Set(fixture.crossOwnerReuseAllowlist ?? []);
  for (const [identity, owners] of ownersByIdentity) {
    if (owners.size > 1 && !allowlist.has(identity)) errors.push(`unapproved cross-owner asset reuse for ${identity}`);
  }
  for (const [key, expected] of byOwner) {
    const actual = actualByOwner.get(key).sort((left, right) => left.order - right.order);
    if (JSON.stringify(actual.map(({ sha256 }) => sha256)) !== JSON.stringify(expected.sha256)) {
      errors.push(`editorial source fixture mismatch for ${key}`);
    }
  }
}

function validateOwnedMetadata(iconManifest, editorialReport, coverFixture, errors) {
  const ownedFiles = new Set();
  const add = (asset, expectedRoot) => {
    const source = decodedAssetPath(asset.src ?? `/assets/icons/${asset.file ?? ''}`);
    if (!source || !source.startsWith(expectedRoot)) {
      errors.push(`ownership inventory has invalid asset path ${asset.src ?? asset.file ?? '<missing>'}`);
      return;
    }
    if (ownedFiles.has(source)) errors.push(`ownership inventory repeats ${source}`);
    ownedFiles.add(source);
    if (!Number.isInteger(asset.width) || asset.width <= 0 || !Number.isInteger(asset.height) || asset.height <= 0) {
      errors.push(`ownership inventory has invalid dimensions for ${source}`);
    }
    if (!Number.isInteger(asset.bytes) || asset.bytes <= 0 || !/^[a-f0-9]{64}$/u.test(asset.sha256 ?? '')) {
      errors.push(`ownership inventory has invalid stat/hash metadata for ${source}`);
    }
  };

  for (const asset of iconManifest) {
    add(asset, '/assets/icons/');
    if (asset.role !== 'original' || !asset.provenance || !asset.sourceUrl || !asset.legacyPath) {
      errors.push(`icon ownership metadata is incomplete for ${asset.file ?? '<missing>'}`);
    }
  }
  for (const asset of editorialReport.assets ?? []) {
    add(asset, asset.ownerType === 'page' ? '/assets/pages/' : '/assets/articles/');
    if (!asset.provenance || !asset.sourceRef) errors.push(`editorial provenance is incomplete for ${asset.src}`);
  }
  const coversBySource = new Map((coverFixture.records ?? []).map((asset) => [asset.src, asset]));
  for (const asset of editorialReport.coverAssets ?? []) {
    add(asset, '/assets/articles/covers/');
    const expected = coversBySource.get(asset.src);
    if (!expected || asset.provenance !== coverFixture.provenance || asset.sha256 !== expected.sha256) {
      errors.push(`editorial cover fixture mismatch for ${asset.src}`);
    }
  }
  if (coversBySource.size !== (editorialReport.coverAssets ?? []).length) {
    errors.push('editorial cover inventory count does not match its fixture');
  }
  return ownedFiles;
}

export async function verifyProject(projectRoot = new URL('../', import.meta.url)) {
  const projectDirectory = projectRoot instanceof URL ? fileURLToPath(projectRoot) : path.resolve(projectRoot);
  const publicDirectory = path.join(projectDirectory, 'public');
  const contentDirectory = path.join(publicDirectory, 'content');
  const errors = [];

  const manifest = await readJson(path.join(contentDirectory, 'manifest.json'));
  if (manifest.version !== 1) errors.push('content manifest version must be 1');
  const manifestKeys = Object.keys(manifest.files ?? {});
  if (JSON.stringify(sorted(manifestKeys)) !== JSON.stringify(sorted(CONTENT_DOCUMENTS))) {
    errors.push('content manifest must name exactly icons, pages, articles, videos, contacts, and aliases');
  }
  const contentFiles = (await readdir(contentDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map(({ name }) => name);
  const declaredFiles = Object.values(manifest.files ?? {});
  for (const file of declaredFiles) {
    if (typeof file !== 'string' || path.basename(file) !== file || !file.endsWith('.json')) {
      errors.push(`content manifest contains unsafe filename ${file}`);
    }
  }
  const expectedContentFiles = new Set(['manifest.json', ...declaredFiles]);
  for (const file of sorted(contentFiles)) {
    if (!expectedContentFiles.has(file)) errors.push(`content directory contains undeclared JSON file ${file}`);
  }
  for (const file of sorted(expectedContentFiles)) {
    if (!contentFiles.includes(file)) errors.push(`content manifest references missing file ${file}`);
  }

  const documents = {};
  for (const key of CONTENT_DOCUMENTS) {
    const file = manifest.files?.[key];
    if (typeof file === 'string' && path.basename(file) === file) documents[key] = await readJson(path.join(contentDirectory, file));
  }
  const bundle = { version: manifest.version, ...documents };

  const [iconManifest, editorialReport, sourceFixture, coverFixture] = await Promise.all([
    readJson(path.join(publicDirectory, 'assets', 'icons', 'manifest.json')),
    readJson(path.join(projectDirectory, 'reports', 'editorial-migration.json')),
    readJson(path.join(projectDirectory, 'tests', 'fixtures', 'migration', 'editorial-source-assets.json')),
    readJson(path.join(projectDirectory, 'tests', 'fixtures', 'migration', 'editorial-cover-assets.json')),
  ]);
  validateSourceOwnershipFixture(editorialReport, sourceFixture, errors);
  const ownedFiles = validateOwnedMetadata(iconManifest, editorialReport, coverFixture, errors);

  const diskFiles = new Set();
  for (const directory of ['icons', 'pages', 'articles']) {
    const files = await collectFiles(path.join(publicDirectory, 'assets', directory), publicDirectory, errors);
    for (const file of files) diskFiles.add(file);
  }
  diskFiles.delete('/assets/icons/manifest.json');

  const referencedFiles = new Set();
  errors.push(...verifyContent(bundle, diskFiles, {
    referencedFiles,
    expected: {
      icons: legacyIconMap.map(({ slug }) => slug),
      pages: legacyPageMap.map(({ slug }) => slug),
      articles: legacyArticleMap.map(({ slug }) => slug),
      videos: ['youtube:y10sw1KIOqQ', 'vimeo:353365425'],
      aliases: expectedAliases(),
      excludedAliases: [EXCLUDED_ARTICLE_PATH],
      excludedSourcePaths: [EXCLUDED_ARTICLE_PATH],
    },
  }));
  for (const assetUrl of referencedFiles) resolvePublicAssetPath(publicDirectory, assetUrl);
  errors.push(...verifyOwnedAssetInventory({ diskFiles, referencedFiles, ownedFiles }));

  const excluded = editorialReport.excludedArticleCandidates ?? [];
  if (excluded.length !== 1
    || excluded[0]?.legacyPath !== EXCLUDED_ARTICLE_PATH
    || excluded[0]?.decision !== 'excluded-by-controller-ruling') {
    errors.push(`editorial report must preserve the exclusion ruling for ${EXCLUDED_ARTICLE_PATH}`);
  }

  return {
    errors,
    summary: {
      icons: bundle.icons?.length ?? 0,
      publishedIcons: bundle.icons?.filter(({ published }) => published).length ?? 0,
      pages: bundle.pages?.length ?? 0,
      articles: bundle.articles?.length ?? 0,
      videos: bundle.videos?.length ?? 0,
      aliases: Object.keys(bundle.aliases ?? {}).length,
      referencedAssets: referencedFiles.size,
      ownedAssets: ownedFiles.size,
    },
  };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const result = await verifyProject();
    if (result.errors.length > 0) {
      console.error(`content integrity failed with ${result.errors.length} error(s):`);
      for (const error of result.errors) console.error(`- ${error}`);
      process.exitCode = 1;
    } else {
      const summary = result.summary;
      console.log(
        `content integrity verified: ${summary.icons} icons (${summary.publishedIcons} published), `
        + `${summary.pages} pages, ${summary.articles} articles, ${summary.videos} videos, `
        + `${summary.aliases} aliases, ${summary.ownedAssets} owned local assets`,
      );
    }
  } catch (error) {
    console.error(`content integrity failed: ${error.message}`);
    process.exitCode = 1;
  }
}
