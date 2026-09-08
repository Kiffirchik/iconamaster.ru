import { extractIconCopy, repairMojibake } from './legacy-html.mjs';

export function summarizeCargoCard(page) {
  const copy = extractIconCopy(`<div class="page_content">${page.content ?? ''}</div>`);
  const originalText = (page.content_no_html ?? '').replace(/\{image[^}]*\}/gu, '').replace(/&nbsp;/gu,' ').replace(/\s+/gu,' ').trim();
  const title = repairMojibake(page.title_no_html ?? page.title ?? '').replace(/\s+/gu, ' ').trim();
  let description = originalText || copy.description;
  if (description.startsWith(title)) description = description.slice(title.length).trim();
  description = description.replace(/(?:цена\s*:?\s*)?(\d{1,3}(?:[ \u00a0]\d{3})+|\d+)\s*(?:руб(?:\.|лей|ля)?|р\.)/iu, '')
    .replace(/Узнать подробнее об иконе\.?/giu,'').replace(/\s+/gu,' ').trim();
  return {
    id: page.id,
    sourcePath: `/${page.project_url}`,
    sourceUrl: `https://iconamaster.cargo.site/${page.project_url}`,
    title,
    published: page.display === true,
    price: copy.price,
    description,
    originalText,
    originals: (page.images ?? []).map(image => ({
      id: image.id, hash: image.hash,
      sourceUrl: `https://freight.cargo.site/t/original/i/${image.hash}/${encodeURIComponent(image.name)}`,
      width: image.width, height: image.height,
      provenance: 'cargo-public-page-api-2026-09-08',
    })),
  };
}

export function findSharedImages(cards) {
  const owners = new Map();
  for (const card of cards) for (const image of card.originals) {
    const ids = owners.get(image.hash) ?? new Set();
    ids.add(card.id);
    owners.set(image.hash, ids);
  }
  return [...owners].filter(([,ids])=>ids.size>1).map(([hash,ids])=>({hash,cardIds:[...ids]}));
}
