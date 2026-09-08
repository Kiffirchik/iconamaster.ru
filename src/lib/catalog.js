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
  return items.filter((item) => ['purpose', 'type', 'period', 'availability'].every((key) => {
    const selected = filters[key];
    if (selected == null || selected === 'all') return true;
    const value = getIconDisplayValue(selected);
    return Boolean(value) && getIconDisplayValue(item[key]) === value;
  }));
}

export function getFilterOptions(items, key) {
  const values = items
    .map((item) => getIconDisplayValue(item?.[key]))
    .filter(Boolean);

  return ['all', ...new Set(values)];
}

export function findIconBySlug(items, slug) {
  return items.find((item) => item.slug === slug) ?? null;
}

export function getNextIcon(items, slug) {
  const index = items.findIndex((item) => item.slug === slug);
  return items[(index + 1 + items.length) % items.length];
}
