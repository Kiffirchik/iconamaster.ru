export function selectBySlug(items, slug) {
  if (!Array.isArray(items)) return null;
  return items.find((item) => item?.slug === slug && item.published !== false) ?? null;
}

export function renderableSections(sections = []) {
  if (!Array.isArray(sections)) return [];

  return sections.filter((section) => {
    if (section?.type === 'image') return Boolean(section.image?.src);
    if (section?.type === 'gallery') return section.images?.some((image) => image?.src);
    if (section?.type === 'text') {
      const hasHeading = typeof section.heading === 'string' && Boolean(section.heading.trim());
      const hasParagraph = section.paragraphs?.some(
        (paragraph) => typeof paragraph === 'string' && Boolean(paragraph.trim())
      );
      return hasHeading || hasParagraph;
    }
    return false;
  });
}
