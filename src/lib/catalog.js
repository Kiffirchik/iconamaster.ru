import { getDiscount } from './pricing.js';
import { getIconSubjects, iconSubjects } from '../data/icon-subjects.js';
import { publishedIcons } from '../content/schema.js';

export function getIconDisplayValue(value) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  const normalized = text.toLowerCase().replace(/\s+/gu, ' ').replace(/[.!…]+$/u, '');
  if (/^[-–—]+$/u.test(normalized) || [
    '', 'уточняется при консультации', 'не указано', 'нет данных',
  ].includes(normalized)) return '';
  return text;
}

export function filterIcons(items, filters = {}) {
  // Legacy callers may still explicitly filter by type; the UI uses purpose only.
  return items.filter((item) => (!filters.discountsOnly || Boolean(getDiscount(item))) &&
    (!filters.subject || filters.subject === 'all' || getIconSubjects(item).includes(filters.subject)) &&
    ['purpose', 'type', 'period', 'availability'].every((key) => {
    const selected = filters[key];
    if (selected == null || selected === 'all') return true;
    const value = getIconDisplayValue(selected);
    return Boolean(value) && getIconDisplayValue(item[key]) === value;
  }));
}

export function getFilterOptions(items, key) {
  if (key === 'subject') {
    const represented = new Set(items.flatMap(getIconSubjects));
    return ['all', ...iconSubjects.map(([label]) => label).filter((label) => represented.has(label))];
  }
  const values = items
    .map((item) => getIconDisplayValue(item?.[key]))
    .filter(Boolean);

  return ['all', ...new Set(values)];
}

export function getHomeCatalogIcons(items, preferredSlugs = []) {
  const published = publishedIcons({ icons: items });
  const bySlug = new Map(published.map((icon) => [icon.slug, icon]));
  const preferred = new Set(preferredSlugs);
  return [
    ...[...preferred].map((slug) => bySlug.get(slug)).filter(Boolean),
    ...published.filter((icon) => !preferred.has(icon.slug)),
  ];
}

export function findIconBySlug(items, slug) {
  return items.find((item) => item.slug === slug) ?? null;
}

export function getNextIcon(items, slug) {
  const index = items.findIndex((item) => item.slug === slug);
  return items[(index + 1 + items.length) % items.length];
}
