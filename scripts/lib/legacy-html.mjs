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

export const normalizeMediaEntries = (entries) => [...new Map(entries.map((entry) => [
  `${entry.url}\u0000${entry.role}\u0000${entry.provenance}`,
  entry,
])).values()].sort((left, right) => (
  left.url.localeCompare(right.url)
  || left.role.localeCompare(right.role)
  || left.provenance.localeCompare(right.provenance)
));

const knownMojibake = new Map([
  ['вЂ“', '–'],
  ['вЂ”', '—'],
  ['вЂ¦', '…'],
  ['в„–', '№'],
]);

const ambiguousMojibake = new Map([
  ['В«', '«'],
  ['В»', '»'],
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
  let identifiedMojibake = [...knownMojibake.keys()].some((corrupted) => text.includes(corrupted));

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
    identifiedMojibake = true;
    index += 1;
  }

  for (const [corrupted, replacement] of knownMojibake) {
    repaired = repaired.replaceAll(corrupted, replacement);
  }

  if (identifiedMojibake) {
    for (const [corrupted, replacement] of ambiguousMojibake) {
      repaired = repaired.replaceAll(corrupted, replacement);
    }
  }

  return repaired;
};

export const extractLinks = (html) => extractAttributeValues(html, 'a', 'href');

export const extractMediaEntries = (html, provenance) => {
  const entries = [];
  const tags = html.match(/<(?:img|source|video|audio)\b[^>]*>/giu) ?? [];

  for (const tag of tags) {
    const attributes = /\b(data-lazy-src|data-src|src|poster)\s*=\s*(["'])(.*?)\2/giu;
    for (const match of tag.matchAll(attributes)) {
      const attribute = match[1].toLowerCase();
      const url = decodeHtmlEntities(match[3].trim());
      if (!/^(?:https?:)?\//u.test(url)) {
        continue;
      }

      const role = attribute === 'data-lazy-src'
        ? 'thumbnail'
        : /\/t\/original\/|files\.cargocollective\.com|\/uploads\//iu.test(url)
          ? 'original'
          : 'page-media';
      entries.push({ url, role, provenance });
    }
  }

  return normalizeMediaEntries(entries);
};

export const extractMediaUrls = (html) => sortedUnique(
  extractMediaEntries(html, 'unspecified').map(({ url }) => url),
);

export const getMediaDisposition = (media) => (media.some(({ role }) => role === 'original')
  ? {
    mediaRecovery: 'not-required',
    publicationStatus: 'pending-validation',
  }
  : {
    mediaRecovery: 'required-public-or-cargo',
    publicationStatus: 'unpublished',
  });

export const partitionContractedLinks = (observed, contract) => {
  const included = sortedUnique(contract.included);
  const excluded = sortedUnique(contract.excluded);
  const expected = sortedUnique([...included, ...excluded]);
  const actual = sortedUnique(observed);

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Contracted links mismatch\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`,
    );
  }

  return { included, excluded };
};

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
      media: extractMediaEntries(match[2], 'catalog-card').map((entry) => ({
        ...entry,
        role: 'thumbnail',
      })),
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

  const media = extractMediaEntries(page.content ?? '', 'cargo-scaffolding-content');
  for (const image of page.images ?? []) {
    if (!image?.hash || !image?.name) {
      continue;
    }
    const encodedName = String(image.name).split('/').map(encodeURIComponent).join('/');
    media.push({
      url: `https://freight.cargo.site/t/original/i/${image.hash}/${encodedName}`,
      role: 'original',
      provenance: 'cargo-scaffolding-images',
    });
  }

  return {
    title: repairMojibake(String(page.title_no_html ?? page.title ?? '')).trim(),
    media: normalizeMediaEntries(media),
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

const extractDivAt = (html, openingIndex) => {
  const tags = /<\/?div\b[^>]*>/giu;
  tags.lastIndex = openingIndex;
  let depth = 0;
  let openingEnd = -1;

  for (const match of html.matchAll(tags)) {
    const closing = /^<\//u.test(match[0]);
    if (!closing) {
      depth += 1;
      if (openingEnd < 0) openingEnd = match.index + match[0].length;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return {
        opening: html.slice(openingIndex, openingEnd),
        inner: html.slice(openingEnd, match.index),
      };
    }
  }

  return null;
};

const visibleText = (html) => repairMojibake(decodeHtmlEntities(html
  .replace(/<!--[\s\S]*?-->/gu, ' ')
  .replace(/<(?:script|style|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|svg)>/giu, ' ')
  .replace(/<a\b[^>]*href\s*=\s*(["'])[^"']*contact-form[^"']*\1[^>]*>[\s\S]*?<\/a>/giu, ' ')
  .replace(/<br\b[^>]*>/giu, '\n')
  .replace(/<\/(?:div|p|h[1-6]|li)>/giu, '\n')
  .replace(/<[^>]+>/gu, ' ')))
  .replace(/\u00a0/gu, ' ')
  .replace(/[\t ]+/gu, ' ')
  .replace(/ *\n */gu, '\n')
  .replace(/\n{2,}/gu, '\n')
  .trim();

const listedPrice = (text) => {
  const match = text.match(/(?:цена\s*:?\s*)?(\d{1,3}(?:[ \u00a0]\d{3})+|\d+)\s*(?:руб(?:\.|лей|ля)?|р\.)/iu);
  if (!match) return null;
  return {
    index: match.index,
    length: match[0].length,
    value: `${match[1].replace(/\s+/gu, ' ')} руб.`,
  };
};

const metadataBeforePrice = (text) => {
  const [firstLine = '', ...remainingLines] = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  let firstLineDetails = '';
  const titleSentenceEnd = firstLine.indexOf('.');
  if (titleSentenceEnd >= 0) {
    firstLineDetails = firstLine.slice(titleSentenceEnd + 1).trim();
  } else {
    const metadataIndex = firstLine.search(/\b(?:\d{1,3}\s*[хx×]\s*\d{1,3}|\d{1,2}\s*(?:век|в\.)|продан[ао]?)\b/iu);
    if (metadataIndex > 0) firstLineDetails = firstLine.slice(metadataIndex).trim();
  }
  return [firstLineDetails, ...remainingLines].filter(Boolean).join(' ');
};

export const extractIconCopy = (html) => {
  const pageOpenings = [...html.matchAll(
    /<div\b[^>]*\bclass\s*=\s*(["'])[^"']*\bpage_content\b[^"']*\1[^>]*>/giu,
  )];
  let productColumn = null;

  for (const pageOpening of pageOpenings) {
    const page = extractDivAt(html, pageOpening.index);
    const rowMatch = page?.inner.match(/<div\b[^>]*\bgrid-row\b[^>]*>/iu);
    const row = rowMatch ? extractDivAt(page.inner, rowMatch.index) : null;
    const columnOpenings = row ? [...row.inner.matchAll(/<div\b[^>]*\bgrid-col\b[^>]*>/giu)] : [];
    const imageColumn = columnOpenings[0]
      ? extractDivAt(row.inner, columnOpenings[0].index)?.inner
      : null;
    const copyColumn = columnOpenings[1]
      ? extractDivAt(row.inner, columnOpenings[1].index)?.inner
      : null;
    if (imageColumn && copyColumn && /\bimage-gallery\b|<img\b/iu.test(imageColumn)) {
      productColumn = copyColumn;
      break;
    }
  }
  if (!productColumn) return { price: null, description: '' };

  const text = visibleText(productColumn);
  const price = listedPrice(text);
  let description = price
    ? [metadataBeforePrice(text.slice(0, price.index)), text.slice(price.index + price.length)]
      .filter(Boolean)
      .join('\n')
    : visibleText(productColumn.replace(
      /<(?:b|strong)\b[^>]*>[\s\S]*?<\/(?:b|strong)>/iu,
      ' ',
    ));
  description = description
    .split('\n')
    .filter((line) => !/^узнать подробнее об иконе\.?$/iu.test(line.trim()))
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();

  return { price: price?.value ?? null, description };
};
