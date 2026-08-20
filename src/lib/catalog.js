export function filterIcons(items, filters) {
  return items.filter((item) =>
    (filters.type === 'all' || item.type === filters.type) &&
    (filters.period === 'all' || item.period === filters.period) &&
    (filters.availability === 'all' || item.availability === filters.availability)
  );
}

export function getFilterOptions(items, key) {
  return ['all', ...new Set(items.map((item) => item[key]))];
}

export function findIconBySlug(items, slug) {
  return items.find((item) => item.slug === slug) ?? null;
}

export function getNextIcon(items, slug) {
  const index = items.findIndex((item) => item.slug === slug);
  return items[(index + 1 + items.length) % items.length];
}
