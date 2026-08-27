import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { legacyArticleMap } from './data/legacy-article-map.mjs';
import { legacyPageMap } from './data/legacy-page-map.mjs';
import { repairMojibake } from './lib/legacy-html.mjs';

const projectDirectory = fileURLToPath(new URL('../', import.meta.url));
const contentDirectory = path.join(projectDirectory, 'public', 'content');
const reportDirectory = path.join(projectDirectory, 'reports');
const runLogPath = path.join(projectDirectory, 'tmp', 'editorial-migration-run.json');
const reportPath = path.join(reportDirectory, 'editorial-migration.json');
const editorialAssetRoot = path.join(projectDirectory, 'public', 'assets');
const editorialAssetStagingRoot = path.join(projectDirectory, 'tmp', 'editorial-assets-staging');
const sourceAssetFixturePath = path.join(projectDirectory, 'tests', 'fixtures', 'migration', 'editorial-source-assets.json');
const outputPaths = {
  pages: path.join(contentDirectory, 'pages.json'),
  articles: path.join(contentDirectory, 'articles.json'),
  videos: path.join(contentDirectory, 'videos.json'),
  contacts: path.join(contentDirectory, 'contacts.json'),
  aliases: path.join(contentDirectory, 'aliases.json'),
};

const excludedArticlePath = '/IKONY-V-OKLADAK-TRADITIY-I-ISTORIY';
const expectedRelevantImageSources = 171;
const sourceSite = 'https://iconamaster.cargo.site';
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sortedUnique = (values) => [...new Set(values)].sort();
export const sortEntriesByCodeUnit = (entries) => [...entries].sort(([left], [right]) => (
  left < right ? -1 : left > right ? 1 : 0
));
const cp1251Bytes = new Map();
const cp1251Decoder = new TextDecoder('windows-1251');

for (let byte = 0; byte <= 0xff; byte += 1) {
  const character = cp1251Decoder.decode(Uint8Array.of(byte));
  if (character !== '\ufffd') cp1251Bytes.set(character, byte);
}
for (let byte = 0x80; byte <= 0x9f; byte += 1) {
  cp1251Bytes.set(String.fromCharCode(byte), byte);
}

const navigationParagraphs = new Set([
  'ИКОНЫ',
  'ЭКСКУРСИИ ПО МАСТЕРСКОЙ',
  'МЕРНАЯ ИКОНА',
  'РЕСТАВРАЦИЯ ИКОН',
  'КИОТЫ И РЕЗЬБА',
  'ОКЛАДЫ НА ИКОНЫ',
  'ИКОНОСТАСЫ',
  'СТАТЬИ',
]);

const namedEntities = {
  amp: '&',
  apos: "'",
  gt: '>',
  hellip: '…',
  laquo: '«',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  raquo: '»',
};

const decodeHtmlEntities = (text) => text
  .replace(/&#x([\da-f]+);/giu, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 16)))
  .replace(/&#(\d+);/gu, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 10)))
  .replace(/&([a-z]+);/giu, (entity, name) => namedEntities[name.toLowerCase()] ?? entity);

const knownMojibakeSequences = ['вЂ“', 'вЂ”', 'вЂ¦', 'в„–'];

const isMojibakePair = (lead, trail) => {
  const trailByte = cp1251Bytes.get(trail);
  if (lead === 'Р') return trailByte === 0x81 || (trailByte >= 0x90 && trailByte <= 0xbf);
  if (lead === 'С') return trailByte === 0x91 || (trailByte >= 0x80 && trailByte <= 0x8f);
  return false;
};

const mojibakeMatches = (text) => {
  const matches = [];
  for (let index = 0; index < text.length; index += 1) {
    const known = knownMojibakeSequences.find((sequence) => text.startsWith(sequence, index));
    if (known) {
      matches.push({ marker: known, index });
      index += known.length - 1;
    } else if (isMojibakePair(text[index], text[index + 1])) {
      matches.push({ marker: text.slice(index, index + 2), index });
      index += 1;
    }
  }
  return matches;
};

export const countMojibakeMarkers = (text) => mojibakeMatches(String(text ?? '')).length;

const mojibakeSamples = (value) => {
  const serialized = JSON.stringify(value);
  return mojibakeMatches(serialized).map((match) => ({
    marker: match.marker,
    context: serialized.slice(Math.max(0, match.index - 40), match.index + match.marker.length + 40),
  }));
};

// Accepted review ruling: this one encoded Cargo token is source debris, not prose.
// Keep the cleanup suffix-only so similar or embedded angle-bracket text is preserved.
const removeKnownSourceDebris = (text) => text.replace(/\s*<б131>$/u, '');

const repairText = (text) => {
  let repaired = decodeHtmlEntities(String(text ?? ''));
  for (let pass = 0; pass < 3; pass += 1) {
    const next = repairMojibake(repaired);
    if (next === repaired) break;
    repaired = next;
  }
  const normalized = repaired
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/\u00a0/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return removeKnownSourceDebris(normalized);
};

const parseAttributes = (tag) => {
  const attributes = {};
  for (const match of tag.matchAll(/\b([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/gu)) {
    attributes[match[1].toLowerCase()] = decodeHtmlEntities(match[3]);
  }
  return attributes;
};

const remoteOriginal = (value) => {
  if (!value) return null;
  const normalized = value.startsWith('//') ? `https:${value}` : value;
  if (!/^https?:\/\//iu.test(normalized)) return null;
  return normalized;
};

const sourceFromImageTag = (tag) => {
  const attributes = parseAttributes(tag);
  const original = remoteOriginal(attributes['data-src']) ?? remoteOriginal(attributes.src);
  const alt = repairText(attributes.alt ?? '');
  const sourceWidth = Number.parseInt(attributes.width ?? attributes.width_o ?? '', 10) || null;
  const sourceHeight = Number.parseInt(attributes.height ?? attributes.height_o ?? '', 10) || null;

  if (original) {
    return {
      sourceKind: 'remote',
      sourceRef: original,
      alt,
      sourceWidth,
      sourceHeight,
    };
  }
  if (attributes.src?.startsWith('data:image/')) {
    return {
      sourceKind: 'data-url',
      sourceRef: attributes.src,
      alt,
      sourceWidth,
      sourceHeight,
    };
  }
  return null;
};

const compactBlocks = (blocks) => {
  const compacted = [];
  for (const block of blocks) {
    const previous = compacted.at(-1);
    if (block.type === 'image' && previous?.type === 'image') {
      compacted.splice(-1, 1, { type: 'gallery', sources: [previous.source, block.source] });
    } else if (block.type === 'image' && previous?.type === 'gallery') {
      previous.sources.push(block.source);
    } else {
      compacted.push(block);
    }
  }
  return compacted;
};

export const parseEditorialMarkup = (sourceMarkup) => {
  const markup = String(sourceMarkup ?? '')
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/giu, '');
  const blocks = [];
  let textBlock = { type: 'text', paragraphs: [] };
  let paragraphParts = [];
  let headingParts = [];
  let headingTag = null;
  let divDepth = 0;
  let gallery = null;

  const flushParagraph = () => {
    const paragraph = repairText(paragraphParts.join(''));
    paragraphParts = [];
    if (paragraph) textBlock.paragraphs.push(paragraph);
  };
  const flushText = () => {
    flushParagraph();
    if (textBlock.heading || textBlock.paragraphs.length > 0) blocks.push(textBlock);
    textBlock = { type: 'text', paragraphs: [] };
  };
  const flushGallery = () => {
    if (gallery?.sources.length > 0) blocks.push({ type: 'gallery', sources: gallery.sources });
    gallery = null;
  };

  const tokens = markup.match(/<[^>]+>|[^<]+/gu) ?? [];
  for (const token of tokens) {
    if (!token.startsWith('<')) {
      if (gallery) continue;
      if (headingTag) headingParts.push(token);
      else paragraphParts.push(token);
      continue;
    }

    const closing = /^<\s*\//u.test(token);
    const tagName = token.match(/^<\s*\/?\s*([\w:-]+)/u)?.[1]?.toLowerCase();
    if (!tagName) continue;

    if (!closing && tagName === 'div') {
      const attributes = parseAttributes(token);
      const classes = attributes.class?.split(/\s+/u) ?? [];
      if (!gallery && classes.includes('image-gallery')) {
        flushText();
        gallery = { depth: divDepth + 1, sources: [] };
      }
      divDepth += 1;
      continue;
    }

    if (closing && tagName === 'div') {
      if (gallery && divDepth === gallery.depth) flushGallery();
      divDepth = Math.max(0, divDepth - 1);
      if (!gallery) flushParagraph();
      continue;
    }

    if (!closing && tagName === 'img') {
      const source = sourceFromImageTag(token);
      if (!source) continue;
      if (gallery) gallery.sources.push(source);
      else {
        flushText();
        blocks.push({ type: 'image', source });
      }
      continue;
    }

    if (!closing && /^h[1-6]$/u.test(tagName)) {
      flushText();
      headingTag = tagName;
      headingParts = [];
      continue;
    }
    if (closing && tagName === headingTag) {
      const heading = repairText(headingParts.join(''));
      headingParts = [];
      headingTag = null;
      if (heading) textBlock.heading = heading;
      continue;
    }

    if (!gallery && (
      tagName === 'br'
      || (closing && ['p', 'li', 'section', 'article', 'tr', 'blockquote'].includes(tagName))
    )) {
      flushParagraph();
    }
  }

  if (gallery) flushGallery();
  if (headingParts.length > 0) {
    const heading = repairText(headingParts.join(''));
    if (heading) textBlock.heading = heading;
  }
  flushText();
  return compactBlocks(blocks);
};

const extractScaffoldingPage = (html, legacyPath) => {
  const opening = html.match(/<script\b[^>]*\bdata-set\s*=\s*(["'])ScaffoldingData\1[^>]*>/iu);
  if (!opening) return null;
  const contentStart = opening.index + opening[0].length;
  const closing = html.slice(contentStart).match(/<\/script\s*>/iu);
  if (!closing) throw new Error(`Unterminated ScaffoldingData for ${legacyPath}`);
  const payload = html.slice(contentStart, contentStart + closing.index);
  const target = legacyPath.slice(1);
  const queue = [JSON.parse(payload)];

  while (queue.length > 0) {
    const candidate = queue.shift();
    if (!candidate || typeof candidate !== 'object') continue;
    if (candidate.project_url === target) return candidate;
    if (Array.isArray(candidate.pages)) queue.push(...candidate.pages);
  }
  return null;
};

const extractLastPageContent = (html, legacyPath) => {
  const openings = [...html.matchAll(/<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\bpage_content\b[^"']*\1[^>]*>/giu)];
  const opening = openings.at(-1);
  if (!opening) throw new Error(`No page_content container for ${legacyPath}`);
  const contentStart = opening.index + opening[0].length;
  const tags = html.slice(contentStart).matchAll(/<\/?div\b[^>]*>/giu);
  let depth = 1;
  for (const tag of tags) {
    if (/^<\s*\/div/iu.test(tag[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return html.slice(contentStart, contentStart + tag.index);
  }
  throw new Error(`Unterminated page_content container for ${legacyPath}`);
};

const extractRecordMarkup = (html, legacyPath, kind) => {
  if (kind === 'article') {
    const page = extractScaffoldingPage(html, legacyPath);
    if (!page) throw new Error(`No ScaffoldingData page for ${legacyPath}`);
    return String(page.content ?? '');
  }
  return extractLastPageContent(html, legacyPath);
};

const removeTechnicalNavigation = (blocks) => {
  let removed = 0;
  const cleaned = blocks.flatMap((block) => {
    if (block.type !== 'text') return [block];
    const paragraphs = block.paragraphs.filter((paragraph) => {
      if (!navigationParagraphs.has(paragraph.toUpperCase())) return true;
      removed += 1;
      return false;
    });
    const heading = block.heading && !navigationParagraphs.has(block.heading.toUpperCase())
      ? block.heading
      : undefined;
    if (block.heading && !heading) removed += 1;
    return heading || paragraphs.length > 0 ? [{ type: 'text', ...(heading ? { heading } : {}), paragraphs }] : [];
  });
  return { blocks: cleaned, removed };
};

const mergeKnownPrayerSoftBreaks = (blocks, ownerSlug) => {
  if (ownerSlug !== 'icon-painting-canon') return { blocks, mergedBreaks: 0 };
  let mergedBreaks = 0;
  const merged = blocks.map((block) => {
    if (block.type !== 'text') return block;
    const start = block.paragraphs.indexOf('Исусе');
    const end = block.paragraphs.indexOf('Аминь.', start + 1);
    if (start < 0 || end < start) return block;
    const prayerLines = block.paragraphs.slice(start, end + 1);
    mergedBreaks += prayerLines.length - 1;
    return {
      ...block,
      paragraphs: [
        ...block.paragraphs.slice(0, start),
        repairText(prayerLines.join(' ')),
        ...block.paragraphs.slice(end + 1),
      ],
    };
  });
  return { blocks: merged, mergedBreaks };
};

const imageDimensions = (bytes) => {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), extension: '.png' };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
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
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + length + 2 > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          width: bytes.readUInt16BE(offset + 7),
          height: bytes.readUInt16BE(offset + 5),
          extension: '.jpg',
        };
      }
      offset += length + 2;
    }
  }
  throw new Error('Unsupported or damaged image bytes');
};

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

const readJsonIfPresent = async (file, fallback) => {
  try {
    return await readJson(file);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
};

const relativeFiles = async (directory, prefix = '') => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory()
      ? relativeFiles(path.join(directory, entry.name), relativePath)
      : [relativePath];
  }));
  return nested.flat().sort();
};

const validateStagedAssets = async (stagingRoot, assets) => {
  const expected = assets.map(({ src }) => src.replace(/^\/assets\//u, '')).sort();
  const actual = [
    ...(await relativeFiles(path.join(stagingRoot, 'pages'))).map((file) => `pages/${file}`),
    ...(await relativeFiles(path.join(stagingRoot, 'articles'))).map((file) => `articles/${file}`),
  ].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Staged editorial asset set mismatch\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
  for (const asset of assets) {
    const bytes = await readFile(path.join(stagingRoot, asset.src.replace(/^\/assets\//u, '')));
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) {
      throw new Error(`Staged editorial asset checksum mismatch: ${asset.src}`);
    }
  }
};

export const replaceEditorialAssetDirectories = async ({ assetsRoot, stagingRoot }) => {
  const names = ['pages', 'articles'];
  const backupRoot = await mkdtemp(path.join(path.dirname(assetsRoot), '.editorial-assets-backup-'));
  const backedUp = [];
  const installed = [];
  try {
    for (const name of names) {
      try {
        await rename(path.join(assetsRoot, name), path.join(backupRoot, name));
        backedUp.push(name);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    for (const name of names) {
      await rename(path.join(stagingRoot, name), path.join(assetsRoot, name));
      installed.push(name);
    }
  } catch (error) {
    for (const name of installed.toReversed()) {
      await rm(path.join(assetsRoot, name), { recursive: true, force: true });
    }
    for (const name of backedUp.toReversed()) {
      await rename(path.join(backupRoot, name), path.join(assetsRoot, name));
    }
    throw error;
  } finally {
    await rm(backupRoot, { recursive: true, force: true });
  }
};

const argument = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const assertExactPaths = (label, records, mappings) => {
  const actual = records.map(({ sourcePath }) => sourcePath).toSorted();
  const expected = mappings.map(({ legacyPath }) => legacyPath).toSorted();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} mismatch\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
};

const validateInputs = async (sourceDirectory, inventory) => {
  if (inventory.schemaVersion !== 2) {
    throw new Error(`Expected inventory schema version 2, found ${inventory.schemaVersion}`);
  }
  if (inventory.source.siteUrl !== sourceSite) throw new Error(`Unexpected source site ${inventory.source.siteUrl}`);
  if (path.basename(sourceDirectory) !== inventory.source.archiveName) {
    throw new Error(`Archive name mismatch: ${path.basename(sourceDirectory)} != ${inventory.source.archiveName}`);
  }
  assertExactPaths('Service map', inventory.services, legacyPageMap);
  assertExactPaths('Article map', inventory.articles, legacyArticleMap);
  const excluded = inventory.excludedArticleCandidates ?? [];
  if (excluded.length !== 1 || excluded[0].sourcePath !== excludedArticlePath) {
    throw new Error(`Excluded article evidence mismatch: ${JSON.stringify(excluded.map(({ sourcePath }) => sourcePath))}`);
  }
};

const decodeDataUrl = (dataUrl) => {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,([a-z\d+/=\s]+)$/iu);
  if (!match) throw new Error('Unsupported embedded image data URL');
  return Buffer.from(match[2].replace(/\s+/gu, ''), 'base64');
};

const fetchOriginal = async (sourceUrl) => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(sourceUrl, {
        redirect: 'follow',
        signal: AbortSignal.timeout(45_000),
        headers: { 'user-agent': 'IconamasterEditorialMigration/1.0' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return {
        bytes: Buffer.from(await response.arrayBuffer()),
        resolvedUrl: response.url,
        contentType: response.headers.get('content-type') ?? '',
        attempt,
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const assetKey = ({ ownerType, ownerSlug, sourceRef }) => `${ownerType}\u0000${ownerSlug}\u0000${sourceRef}`;
const ownerKey = ({ ownerType, ownerSlug }) => `${ownerType}:${ownerSlug}`;

export const validateSourceOwnershipFixture = (assets, fixture) => {
  if (fixture?.schemaVersion !== 1 || !Array.isArray(fixture.records)) {
    throw new Error('Expected editorial source ownership fixture schema version 1');
  }
  const allowlist = new Set(fixture.crossOwnerReuseAllowlist ?? []);
  const ownersByIdentity = new Map();
  const assetsByOwner = new Map();

  for (const expected of fixture.records) {
    const key = ownerKey(expected);
    if (assetsByOwner.has(key)) throw new Error(`Duplicate source fixture owner: ${key}`);
    assetsByOwner.set(key, []);
  }
  for (const asset of assets) {
    const key = ownerKey(asset);
    const owned = assetsByOwner.get(key);
    if (!owned) throw new Error(`Source fixture has no owner for ${key}`);
    owned.push(asset);
    for (const identity of [`sourceRef:${asset.sourceRef}`, `sha256:${asset.sha256}`]) {
      const owners = ownersByIdentity.get(identity) ?? new Set();
      owners.add(key);
      ownersByIdentity.set(identity, owners);
    }
  }

  for (const [identity, owners] of ownersByIdentity) {
    if (owners.size > 1 && !allowlist.has(identity)) {
      throw new Error(`Unapproved cross-owner reuse for ${identity}: ${[...owners].join(', ')}`);
    }
  }
  for (const expected of fixture.records) {
    const key = ownerKey(expected);
    const owned = assetsByOwner.get(key).toSorted((left, right) => left.order - right.order);
    const orders = owned.map(({ order }) => order);
    const expectedOrders = expected.sha256.map((_, index) => index + 1);
    if (JSON.stringify(orders) !== JSON.stringify(expectedOrders)) {
      throw new Error(`Source fixture order mismatch for ${key}`);
    }
    const checksums = owned.map(({ sha256: checksum }) => checksum);
    if (JSON.stringify(checksums) !== JSON.stringify(expected.sha256)) {
      throw new Error(`Source fixture checksum mismatch for ${key}`);
    }
  }
};

const prepareRecords = async ({ sourceDirectory, inventoryRecords, mappings, kind }) => {
  const inventoryByPath = new Map(inventoryRecords.map((record) => [record.sourcePath, record]));
  const records = [];
  for (const mapping of mappings) {
    const source = inventoryByPath.get(mapping.legacyPath);
    const html = await readFile(path.join(sourceDirectory, source.localPath), 'utf8');
    const markup = extractRecordMarkup(html, mapping.legacyPath, kind);
    const parsed = parseEditorialMarkup(markup);
    const navigation = removeTechnicalNavigation(parsed);
    const prayer = mergeKnownPrayerSoftBreaks(navigation.blocks, mapping.slug);
    const plainSource = decodeHtmlEntities(markup.replace(/<[^>]+>/gu, ' '));
    records.push({
      kind,
      mapping,
      source,
      markup,
      blocks: prayer.blocks,
      sourceMarkers: countMojibakeMarkers(plainSource),
      removedKnownSourceDebris: markup.match(/(?:&lt;|<)б131(?:&gt;|>)/gu)?.length ?? 0,
      removedNavigationParagraphs: navigation.removed,
      mergedPrayerSoftBreaks: prayer.mergedBreaks,
      removedIframes: markup.match(/<iframe\b/giu)?.length ?? 0,
    });
  }
  return records;
};

const prepareCandidates = (preparedRecords) => {
  const candidates = [];
  const candidateByKey = new Map();
  const ownerCounts = new Map();

  const prepareSource = (record, source) => {
    let bytes = null;
    let sourceRef = source.sourceRef;
    let identity = sourceRef;
    if (source.sourceKind === 'data-url') {
      bytes = decodeDataUrl(source.sourceRef);
      identity = `data:${sha256(bytes)}`;
    }
    const ownerIdentity = `${record.kind}\u0000${record.mapping.slug}\u0000${identity}`;
    const existing = candidateByKey.get(ownerIdentity);
    if (existing) return existing;

    const ownerKey = `${record.kind}\u0000${record.mapping.slug}`;
    const ordinal = (ownerCounts.get(ownerKey) ?? 0) + 1;
    ownerCounts.set(ownerKey, ordinal);
    if (source.sourceKind === 'data-url') {
      sourceRef = `${record.source.sourceUrl}#embedded-image-${ordinal}`;
    }
    const evidence = source.sourceKind === 'remote'
      ? sortedUnique(record.source.media
        .filter((media) => media.url === source.sourceRef && media.role === 'original')
        .map(({ provenance }) => provenance))
      : ['rendered-local-page-content'];
    if (source.sourceKind === 'remote' && evidence.length === 0) {
      throw new Error(`Remote editorial image lacks original-media evidence: ${source.sourceRef}`);
    }
    const candidate = {
      key: ownerIdentity,
      ownerType: record.kind,
      ownerSlug: record.mapping.slug,
      ownerTitle: record.mapping.title,
      ordinal,
      sourceKind: source.sourceKind,
      sourceRef,
      originalSourceRef: source.sourceRef,
      bytes,
      alt: source.alt || record.mapping.title,
      evidence,
    };
    candidates.push(candidate);
    candidateByKey.set(ownerIdentity, candidate);
    return candidate;
  };

  for (const record of preparedRecords) {
    for (const block of record.blocks) {
      if (block.type === 'image') block.candidate = prepareSource(record, block.source);
      if (block.type === 'gallery') block.candidates = block.sources.map((source) => prepareSource(record, source));
    }
  }
  return candidates;
};

const migrateCandidate = async ({ candidate, previousAssetsByKey, liveAttempts, stagingRoot }) => {
  const previous = previousAssetsByKey.get(assetKey(candidate));
  let bytes = candidate.bytes;
  let live = null;
  if (!bytes && previous) {
    try {
      const reusable = await readFile(path.join(projectDirectory, 'public', previous.src));
      if (reusable.length !== previous.bytes || sha256(reusable) !== previous.sha256) {
        throw new Error('committed asset checksum mismatch');
      }
      bytes = reusable;
      live = { outcome: 'reused-verified-bytes' };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!bytes) {
    const fetched = await fetchOriginal(candidate.sourceRef);
    bytes = fetched.bytes;
    live = {
      outcome: 'downloaded-original-bytes',
      resolvedUrl: fetched.resolvedUrl,
      contentType: fetched.contentType,
      attempt: fetched.attempt,
    };
  }

  const dimensions = imageDimensions(bytes);
  const directoryName = candidate.ownerType === 'page' ? 'pages' : 'articles';
  const fileName = `${candidate.ownerSlug}${candidate.ordinal === 1 ? '' : `-${candidate.ordinal}`}${dimensions.extension}`;
  const directory = path.join(stagingRoot, directoryName);
  const destination = path.join(directory, fileName);
  const src = `/assets/${directoryName}/${fileName}`;
  await mkdir(directory, { recursive: true });
  await writeFile(destination, bytes);

  const asset = {
    ownerType: candidate.ownerType,
    ownerSlug: candidate.ownerSlug,
    order: candidate.ordinal,
    src,
    width: dimensions.width,
    height: dimensions.height,
    bytes: bytes.length,
    sha256: sha256(bytes),
    sourceRef: candidate.sourceRef,
    provenance: candidate.sourceKind === 'data-url'
      ? 'local-archive-data-url'
      : 'cargo-original-url',
    evidence: candidate.evidence,
  };
  liveAttempts.push({
    ownerType: candidate.ownerType,
    ownerSlug: candidate.ownerSlug,
    sourceRef: candidate.sourceRef,
    ...(live ?? { outcome: 'decoded-local-archive-data-url' }),
    src,
    bytes: bytes.length,
    sha256: asset.sha256,
  });
  return asset;
};

const migrateCandidates = async (candidates, previousReport, stagingRoot) => {
  const previousAssetsByKey = new Map((previousReport?.assets ?? []).map((asset) => [assetKey(asset), asset]));
  const results = new Map();
  const liveAttempts = [];
  const failures = [];
  let nextIndex = 0;
  let completed = 0;

  const worker = async () => {
    while (nextIndex < candidates.length) {
      const candidate = candidates[nextIndex];
      nextIndex += 1;
      try {
        results.set(candidate.key, await migrateCandidate({ candidate, previousAssetsByKey, liveAttempts, stagingRoot }));
      } catch (error) {
        failures.push({ candidate, error });
        liveAttempts.push({
          ownerType: candidate.ownerType,
          ownerSlug: candidate.ownerSlug,
          sourceRef: candidate.sourceRef,
          outcome: 'unavailable',
          error: error.message,
        });
      }
      completed += 1;
      if (completed % 20 === 0 || completed === candidates.length) {
        console.log(`Editorial media ${completed}/${candidates.length}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, candidates.length) }, () => worker()));
  return { results, liveAttempts, failures };
};

const publicImage = (candidate, asset) => ({
  src: asset.src,
  alt: candidate.alt,
  width: asset.width,
  height: asset.height,
});

const firstCandidate = (prepared) => prepared.blocks.flatMap((block) => (
  block.type === 'image' ? [block.candidate]
    : block.type === 'gallery' ? block.candidates
      : []
))[0];

const createCoverDerivative = async (source, destination) => {
  const args = [
    '-hide_banner',
    '-loglevel', 'error',
    '-nostdin',
    '-i', source,
    '-frames:v', '1',
    '-vf', 'scale=640:640:force_original_aspect_ratio=decrease:flags=lanczos',
    '-map_metadata', '-1',
    '-c:v', 'mjpeg',
    '-q:v', '5',
    '-pix_fmt', 'yuvj420p',
    '-fflags', '+bitexact',
    '-flags:v', '+bitexact',
    '-threads', '1',
    '-y', destination,
  ];
  await new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg cover generation failed (${code}): ${stderr.trim()}`));
    });
  });
};

const generateArticleCovers = async (preparedArticles, migration, stagingRoot) => {
  const coverDirectory = path.join(stagingRoot, 'articles', 'covers');
  await mkdir(coverDirectory, { recursive: true });
  const assets = [];
  const byOwner = new Map();
  for (const prepared of preparedArticles) {
    const candidate = firstCandidate(prepared);
    const sourceAsset = candidate && migration.results.get(candidate.key);
    if (!sourceAsset) throw new Error(`Article cover source is unavailable: ${prepared.mapping.slug}`);
    const fileName = `${prepared.mapping.slug}.jpg`;
    const sourcePath = path.join(stagingRoot, sourceAsset.src.replace(/^\/assets\//u, ''));
    const destination = path.join(coverDirectory, fileName);
    await createCoverDerivative(sourcePath, destination);
    const bytes = await readFile(destination);
    const dimensions = imageDimensions(bytes);
    if (dimensions.extension !== '.jpg') throw new Error(`Article cover is not JPEG: ${prepared.mapping.slug}`);
    if (Math.max(dimensions.width, dimensions.height) > 640 || Math.min(dimensions.width, dimensions.height) < 300) {
      throw new Error(`Article cover dimensions are not useful: ${prepared.mapping.slug} (${dimensions.width}x${dimensions.height})`);
    }
    if (bytes.length >= sourceAsset.bytes * 0.75) {
      throw new Error(`Article cover is not materially smaller: ${prepared.mapping.slug}`);
    }
    const asset = {
      ownerType: 'article',
      ownerSlug: prepared.mapping.slug,
      src: `/assets/articles/covers/${fileName}`,
      width: dimensions.width,
      height: dimensions.height,
      bytes: bytes.length,
      sha256: sha256(bytes),
      sourceAssetSrc: sourceAsset.src,
      sourceAssetSha256: sourceAsset.sha256,
      sourceRef: sourceAsset.sourceRef,
      provenance: 'ffmpeg-mjpeg-cover-v1',
      transform: {
        format: 'jpeg',
        maxDimension: 640,
        qualityScale: 5,
      },
    };
    assets.push(asset);
    byOwner.set(prepared.mapping.slug, asset);
  }
  return { assets, byOwner };
};

const buildPublicRecords = (preparedRecords, migration, coverAssetsByOwner = new Map()) => {
  const records = [];
  const omittedBlocks = [];
  const omittedMedia = [];

  for (const prepared of preparedRecords) {
    const sections = [];
    if (prepared.removedIframes > 0) {
      omittedBlocks.push({
        ownerType: prepared.kind,
        ownerSlug: prepared.mapping.slug,
        blockType: 'iframe',
        count: prepared.removedIframes,
        reason: 'external-video-migrated-to-videos',
      });
    }
    for (const block of prepared.blocks) {
      if (block.type === 'text') {
        if (block.heading || block.paragraphs.length > 0) sections.push(block);
        continue;
      }
      if (block.type === 'image') {
        const asset = migration.results.get(block.candidate.key);
        if (asset) sections.push({ type: 'image', image: publicImage(block.candidate, asset) });
        else {
          omittedMedia.push({
            ownerType: prepared.kind,
            ownerSlug: prepared.mapping.slug,
            sourceRef: block.candidate.sourceRef,
            reason: 'source-unavailable-or-damaged',
          });
          omittedBlocks.push({
            ownerType: prepared.kind,
            ownerSlug: prepared.mapping.slug,
            blockType: 'image',
            reason: 'source-unavailable-or-damaged',
          });
        }
        continue;
      }

      const images = [];
      for (const candidate of block.candidates) {
        const asset = migration.results.get(candidate.key);
        if (asset) images.push(publicImage(candidate, asset));
        else omittedMedia.push({
          ownerType: prepared.kind,
          ownerSlug: prepared.mapping.slug,
          sourceRef: candidate.sourceRef,
          reason: 'source-unavailable-or-damaged',
        });
      }
      if (images.length > 0) sections.push({ type: 'gallery', images });
      else omittedBlocks.push({
        ownerType: prepared.kind,
        ownerSlug: prepared.mapping.slug,
        blockType: 'gallery',
        reason: 'no-valid-images-remain',
      });
    }

    const firstParagraph = sections
      .filter(({ type }) => type === 'text')
      .flatMap(({ paragraphs }) => paragraphs)
      .find((paragraph) => paragraph.length >= 80);
    const coverAsset = coverAssetsByOwner.get(prepared.mapping.slug);
    records.push({
      id: prepared.mapping.slug,
      slug: prepared.mapping.slug,
      title: prepared.mapping.title,
      published: true,
      order: records.length + 1,
      sourceUrl: prepared.source.sourceUrl,
      ...(prepared.kind === 'article' && firstParagraph ? { summary: firstParagraph } : {}),
      ...(prepared.kind === 'article' && coverAsset ? {
        image: {
          src: coverAsset.src,
          alt: prepared.mapping.title,
          width: coverAsset.width,
          height: coverAsset.height,
        },
      } : {}),
      sections,
    });
  }
  return { records, omittedBlocks, omittedMedia };
};

const outputEntry = (id, relativePath, serialized, records) => ({
  id,
  path: relativePath,
  records,
  bytes: Buffer.byteLength(serialized),
  sha256: sha256(Buffer.from(serialized)),
});

const main = async () => {
  const sourceArgument = argument('--source');
  const inventoryArgument = argument('--inventory');
  if (!sourceArgument || !inventoryArgument) {
    throw new Error('Usage: node scripts/migrate-editorial-content.mjs --source <archive-directory> --inventory <inventory-json>');
  }
  const sourceDirectory = path.resolve(sourceArgument);
  const inventoryPath = path.resolve(inventoryArgument);
  if (!(await stat(sourceDirectory)).isDirectory()) throw new Error(`Source is not a directory: ${sourceDirectory}`);
  const inventory = await readJson(inventoryPath);
  await validateInputs(sourceDirectory, inventory);

  const [existingAliases, previousReport, sourceAssetFixtureBytes, preparedPages, preparedArticles] = await Promise.all([
    readJson(outputPaths.aliases),
    readJsonIfPresent(reportPath, null),
    readFile(sourceAssetFixturePath),
    prepareRecords({
      sourceDirectory,
      inventoryRecords: inventory.services,
      mappings: legacyPageMap,
      kind: 'page',
    }),
    prepareRecords({
      sourceDirectory,
      inventoryRecords: inventory.articles,
      mappings: legacyArticleMap,
      kind: 'article',
    }),
  ]);
  const preparedRecords = [...preparedPages, ...preparedArticles];
  const candidates = prepareCandidates(preparedRecords);
  if (candidates.length !== expectedRelevantImageSources) {
    throw new Error(`Expected ${expectedRelevantImageSources} relevant editorial image sources, found ${candidates.length}`);
  }

  await rm(editorialAssetStagingRoot, { recursive: true, force: true });
  await Promise.all([
    mkdir(path.join(editorialAssetStagingRoot, 'pages'), { recursive: true }),
    mkdir(path.join(editorialAssetStagingRoot, 'articles'), { recursive: true }),
  ]);
  const migration = await migrateCandidates(candidates, previousReport, editorialAssetStagingRoot);
  const coverBuild = await generateArticleCovers(preparedArticles, migration, editorialAssetStagingRoot);
  const pageBuild = buildPublicRecords(preparedPages, migration);
  const articleBuild = buildPublicRecords(preparedArticles, migration, coverBuild.byOwner);
  const pages = pageBuild.records;
  const articles = articleBuild.records;
  const videos = [
    {
      provider: 'youtube',
      id: 'y10sw1KIOqQ',
      title: 'Мастерская и иконопись',
      description: 'Посмотрите материалы о работе московской иконописной мастерской. Видео запускаются только после нажатия.',
      autoplay: false,
      published: true,
      sourceUrl: `${sourceSite}/VIDEO`,
    },
    {
      provider: 'vimeo',
      id: '353365425',
      title: 'Работа мастерской',
      description: 'Посмотрите материалы о работе московской иконописной мастерской. Видео запускаются только после нажатия.',
      autoplay: false,
      published: true,
      sourceUrl: `${sourceSite}/VIDEO`,
    },
  ];
  const contacts = {
    whatsapp: '79166554595',
    phone: '+79166554595',
    email: 'iconamaster@yandex.ru',
    sourceUrl: `${sourceSite}/KONTAKTY`,
  };
  const editorialAliases = Object.fromEntries([
    ...legacyPageMap.flatMap((mapping) => mapping.aliases.map((alias) => [alias, `/${mapping.slug}`])),
    ...legacyArticleMap.flatMap((mapping) => mapping.aliases.map((alias) => [alias, `/articles/${mapping.slug}`])),
  ]);
  const aliases = Object.fromEntries(sortEntriesByCodeUnit(Object.entries({
    ...existingAliases,
    ...editorialAliases,
  })));

  const pagesJson = json(pages);
  const articlesJson = json(articles);
  const videosJson = json(videos);
  const contactsJson = json(contacts);
  const aliasesJson = json(aliases);
  const assets = candidates
    .map((candidate) => migration.results.get(candidate.key))
    .filter(Boolean);
  const sourceAssetFixture = JSON.parse(sourceAssetFixtureBytes);
  validateSourceOwnershipFixture(assets, sourceAssetFixture);
  await validateStagedAssets(editorialAssetStagingRoot, [...assets, ...coverBuild.assets]);
  const omittedMedia = [...pageBuild.omittedMedia, ...articleBuild.omittedMedia]
    .filter((entry, index, entries) => entries.findIndex((candidate) => (
      candidate.ownerType === entry.ownerType
      && candidate.ownerSlug === entry.ownerSlug
      && candidate.sourceRef === entry.sourceRef
    )) === index);
  const omittedBlocks = [...pageBuild.omittedBlocks, ...articleBuild.omittedBlocks];
  const encodingRecords = preparedRecords.map((prepared) => {
    const publicRecord = prepared.kind === 'page'
      ? pages.find(({ slug }) => slug === prepared.mapping.slug)
      : articles.find(({ slug }) => slug === prepared.mapping.slug);
    return {
      ownerType: prepared.kind,
      ownerSlug: prepared.mapping.slug,
      sourceMarkers: prepared.sourceMarkers,
      unresolvedMarkers: countMojibakeMarkers(JSON.stringify(publicRecord)),
      unresolvedSamples: mojibakeSamples(publicRecord),
    };
  });
  const unresolved = encodingRecords.filter(({ unresolvedMarkers }) => unresolvedMarkers > 0);
  if (unresolved.length > 0) {
    throw new Error(`Unresolved mojibake remains: ${JSON.stringify(unresolved)}`);
  }
  const excluded = inventory.excludedArticleCandidates[0];
  const report = {
    schemaVersion: 1,
    source: {
      siteUrl: inventory.source.siteUrl,
      archiveName: inventory.source.archiveName,
      inventorySchemaVersion: inventory.schemaVersion,
    },
    sourceAssetFixture: {
      path: 'tests/fixtures/migration/editorial-source-assets.json',
      schemaVersion: sourceAssetFixture.schemaVersion,
      sha256: sha256(sourceAssetFixtureBytes),
    },
    outputs: [
      outputEntry('pages', 'public/content/pages.json', pagesJson, pages.length),
      outputEntry('articles', 'public/content/articles.json', articlesJson, articles.length),
      outputEntry('videos', 'public/content/videos.json', videosJson, videos.length),
      outputEntry('contacts', 'public/content/contacts.json', contactsJson, 1),
      outputEntry('aliases', 'public/content/aliases.json', aliasesJson, Object.keys(aliases).length),
    ],
    summary: {
      records: { pages: pages.length, articles: articles.length, videos: videos.length, contacts: 1 },
      aliases: Object.keys(aliases).length,
      editorialAliases: Object.keys(editorialAliases).length,
      relevantImageSources: candidates.length,
      originalAssetFiles: assets.length,
      coverAssetFiles: coverBuild.assets.length,
      assetFiles: assets.length + coverBuild.assets.length,
      originalAssetBytes: assets.reduce((total, asset) => total + asset.bytes, 0),
      coverAssetBytes: coverBuild.assets.reduce((total, asset) => total + asset.bytes, 0),
      assetBytes: [...assets, ...coverBuild.assets].reduce((total, asset) => total + asset.bytes, 0),
      omittedImageSources: omittedMedia.length,
      omittedBlocks: omittedBlocks.length,
      repairedNavigationParagraphs: preparedRecords.reduce(
        (total, prepared) => total + prepared.removedNavigationParagraphs,
        0,
      ),
      removedKnownSourceDebris: preparedRecords.reduce(
        (total, prepared) => total + prepared.removedKnownSourceDebris,
        0,
      ),
      mergedPrayerSoftBreaks: preparedRecords.reduce(
        (total, prepared) => total + prepared.mergedPrayerSoftBreaks,
        0,
      ),
      unresolvedMojibakeMarkers: 0,
    },
    encoding: {
      policy: 'Repair only recognized UTF-8-as-Windows-1251 mojibake sequences; preserve all other source wording.',
      repairedMarkers: encodingRecords.reduce((total, record) => total + record.sourceMarkers, 0),
      records: encodingRecords,
      unresolved,
    },
    mediaPolicy: 'Relevant originals are copied byte-for-byte for sections. Article cards use separate deterministic JPEG cover derivatives while the full originals remain available in article sections.',
    assets,
    coverAssets: coverBuild.assets,
    omittedMedia,
    omittedBlocks,
    technicalDebrisRemoved: preparedRecords.flatMap((prepared) => [
      ...(prepared.removedNavigationParagraphs > 0 ? [{
        ownerType: prepared.kind,
        ownerSlug: prepared.mapping.slug,
        kind: 'legacy-navigation-paragraphs',
        count: prepared.removedNavigationParagraphs,
      }] : []),
      ...(prepared.removedIframes > 0 ? [{
        ownerType: prepared.kind,
        ownerSlug: prepared.mapping.slug,
        kind: 'legacy-iframe',
        count: prepared.removedIframes,
      }] : []),
      ...(prepared.removedKnownSourceDebris > 0 ? [{
        ownerType: prepared.kind,
        ownerSlug: prepared.mapping.slug,
        kind: 'known-source-debris-<б131>',
        count: prepared.removedKnownSourceDebris,
      }] : []),
    ]),
    textNormalizations: preparedRecords.flatMap((prepared) => (
      prepared.mergedPrayerSoftBreaks > 0 ? [{
        ownerType: prepared.kind,
        ownerSlug: prepared.mapping.slug,
        kind: 'known-prayer-soft-br-merge',
        mergedBreaks: prepared.mergedPrayerSoftBreaks,
      }] : []
    )),
    aliases: Object.entries(editorialAliases).map(([legacyPath, canonicalPath]) => ({ legacyPath, canonicalPath })),
    excludedArticleCandidates: [{
      legacyPath: excluded.sourcePath,
      sourceUrl: excluded.sourceUrl,
      title: excluded.title,
      decision: 'excluded-by-controller-ruling',
      evidence: {
        localPath: excluded.localPath,
        mediaCount: excluded.media.length,
        issues: excluded.issues ?? [],
      },
    }],
    records: [
      ...pages.map((record) => ({
        kind: 'page',
        slug: record.slug,
        title: record.title,
        sourceUrl: record.sourceUrl,
        sections: record.sections.length,
        media: record.sections.flatMap((section) => section.type === 'image' ? [section.image] : section.images ?? []).length,
      })),
      ...articles.map((record) => ({
        kind: 'article',
        slug: record.slug,
        title: record.title,
        sourceUrl: record.sourceUrl,
        sections: record.sections.length,
        media: record.sections.flatMap((section) => section.type === 'image' ? [section.image] : section.images ?? []).length,
      })),
    ],
  };
  const runLog = {
    schemaVersion: 1,
    source: { archive: sourceDirectory, inventory: inventoryPath },
    attempts: migration.liveAttempts,
    failures: migration.failures.map(({ candidate, error }) => ({
      ownerType: candidate.ownerType,
      ownerSlug: candidate.ownerSlug,
      sourceRef: candidate.sourceRef,
      error: error.stack ?? error.message,
    })),
  };

  await Promise.all([
    mkdir(reportDirectory, { recursive: true }),
    mkdir(path.dirname(runLogPath), { recursive: true }),
  ]);
  await replaceEditorialAssetDirectories({
    assetsRoot: editorialAssetRoot,
    stagingRoot: editorialAssetStagingRoot,
  });
  await rm(editorialAssetStagingRoot, { recursive: true, force: true });
  await Promise.all([
    writeFile(outputPaths.pages, pagesJson, 'utf8'),
    writeFile(outputPaths.articles, articlesJson, 'utf8'),
    writeFile(outputPaths.videos, videosJson, 'utf8'),
    writeFile(outputPaths.contacts, contactsJson, 'utf8'),
    writeFile(outputPaths.aliases, aliasesJson, 'utf8'),
    writeFile(reportPath, json(report), 'utf8'),
    writeFile(runLogPath, json(runLog), 'utf8'),
  ]);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Editorial migration report written to ${reportPath}`);
  console.log(`Live migration diagnostics written to ${runLogPath}`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
