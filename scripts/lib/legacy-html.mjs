const cp1251Bytes = new Map();
const cp1251Decoder = new TextDecoder('windows-1251');

for (let byte = 0; byte <= 0xff; byte += 1) {
  const character = cp1251Decoder.decode(Uint8Array.of(byte));
  if (character !== '\ufffd') {
    cp1251Bytes.set(character, byte);
  }
}

for (let byte = 0x80; byte <= 0x9f; byte += 1) {
  cp1251Bytes.set(String.fromCharCode(byte), byte);
}

const sortedUnique = (values) => [...new Set(values)].sort();

const knownMojibake = new Map([
  ['В ', '\u00a0'],
  ['В«', '«'],
  ['В»', '»'],
  ['вЂ“', '–'],
  ['вЂ”', '—'],
  ['вЂ¦', '…'],
  ['в„–', '№'],
]);

const decodeHtmlEntities = (text) => text
  .replace(/&#x([\da-f]+);/giu, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 16)))
  .replace(/&#(\d+);/gu, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 10)))
  .replace(/&(nbsp|amp|quot|apos|lt|gt);/giu, (_, entity) => ({
    nbsp: '\u00a0',
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
  })[entity.toLowerCase()]);

const extractAttributeValues = (html, tagPattern, attributePattern) => {
  const values = [];
  const tags = html.match(new RegExp(`<(?:${tagPattern})\\b[^>]*>`, 'giu')) ?? [];

  for (const tag of tags) {
    const attributes = new RegExp(`\\b(?:${attributePattern})\\s*=\\s*(["'])(.*?)\\1`, 'giu');
    for (const match of tag.matchAll(attributes)) {
      values.push(decodeHtmlEntities(match[2].trim()));
    }
  }

  return sortedUnique(values.filter(Boolean));
};

export const repairMojibake = (text) => {
  let repaired = '';

  for (let index = 0; index < text.length; index += 1) {
    const lead = text[index];
    const leadByte = lead === 'Р' ? 0xd0 : lead === 'С' ? 0xd1 : undefined;
    const trailByte = cp1251Bytes.get(text[index + 1]);
    const isKnownPair = leadByte === 0xd0
      ? trailByte === 0x81 || (trailByte >= 0x90 && trailByte <= 0xbf)
      : leadByte === 0xd1
        ? trailByte === 0x91 || (trailByte >= 0x80 && trailByte <= 0x8f)
        : false;

    if (!isKnownPair) {
      repaired += lead;
      continue;
    }

    repaired += Buffer.from([leadByte, trailByte]).toString('utf8');
    index += 1;
  }

  for (const [corrupted, replacement] of knownMojibake) {
    repaired = repaired.replaceAll(corrupted, replacement);
  }

  return repaired;
};

export const extractLinks = (html) => extractAttributeValues(html, 'a', 'href');

export const extractMediaUrls = (html) => extractAttributeValues(
  html,
  'img|source|video|audio',
  'data-lazy-src|data-src|src|poster',
).filter((url) => /^(?:https?:)?\//u.test(url));

export const extractLinkedCards = (html) => {
  const cards = new Map();

  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/giu)) {
    if (!/\bclass\s*=\s*(["'])[^"']*\bimage-link\b[^"']*\1/iu.test(match[1])) {
      continue;
    }

    const [sourcePath] = extractLinks(`<a ${match[1]}>`);
    if (!sourcePath || cards.has(sourcePath)) {
      continue;
    }

    const titleMatch = match[2].match(
      /<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\btitle\b[^"']*\1[^>]*>([\s\S]*?)<\/div>/iu,
    );
    const title = titleMatch
      ? repairMojibake(decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/gu, ' ')))
        .replace(/\s+/gu, ' ')
        .trim()
      : '';

    cards.set(sourcePath, {
      sourcePath,
      title,
      mediaUrls: extractMediaUrls(match[2]),
    });
  }

  return [...cards.values()].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
};

export const extractEmbeddedPage = (html, sourcePath) => {
  const opening = html.match(
    /<script\b[^>]*\bdata-set\s*=\s*(["'])ScaffoldingData\1[^>]*>/iu,
  );
  if (!opening) {
    return null;
  }

  const contentStart = opening.index + opening[0].length;
  const closing = html.slice(contentStart).match(/<\/script\s*>/iu);
  if (!closing) {
    throw new Error('Unterminated ScaffoldingData script');
  }
  const payload = html.slice(contentStart, contentStart + closing.index);

  const target = sourcePath.replace(/^\//u, '');
  const queue = [JSON.parse(payload)];
  let page = null;

  while (queue.length > 0) {
    const candidate = queue.shift();
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }
    if (candidate.project_url === target) {
      page = candidate;
      break;
    }
    if (Array.isArray(candidate.pages)) {
      queue.push(...candidate.pages);
    }
  }

  if (!page) {
    return null;
  }

  const mediaUrls = extractMediaUrls(page.content ?? '');
  for (const image of page.images ?? []) {
    if (!image?.hash || !image?.name || mediaUrls.some((url) => url.includes(`/i/${image.hash}/`))) {
      continue;
    }
    const encodedName = String(image.name).split('/').map(encodeURIComponent).join('/');
    mediaUrls.push(`https://freight.cargo.site/t/original/i/${image.hash}/${encodedName}`);
  }

  return {
    title: repairMojibake(String(page.title_no_html ?? page.title ?? '')).trim(),
    mediaUrls: sortedUnique(mediaUrls),
  };
};

export const extractTitle = (html) => {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu);
  if (!match) {
    return '';
  }

  const text = decodeHtmlEntities(match[1].replace(/<[^>]+>/gu, ' '));
  return repairMojibake(text).replace(/\s+/gu, ' ').trim();
};
