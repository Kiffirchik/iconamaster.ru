export function selectBySlug(items, slug) {
  if (!Array.isArray(items)) return null;
  return items.find((item) => item?.slug === slug && item.published !== false) ?? null;
}

export function renderableSections(sections = []) {
  if (!Array.isArray(sections)) return [];

  return sections.filter((section) => {
    if (section?.type === 'image') return Boolean(section.image?.src);
    if (section?.type === 'gallery') return section.images?.some((image) => image?.src);
    if (section?.type === 'text') return Boolean(section.heading || section.paragraphs?.length);
    return false;
  });
}
