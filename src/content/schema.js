const requiredCollections = ['icons', 'pages', 'articles', 'videos'];

export function validateContentBundle(bundle) {
  const errors = [];
  if (bundle?.version !== 1) errors.push('content version must be 1');
  for (const key of requiredCollections) {
    if (!Array.isArray(bundle?.[key])) errors.push(`${key} must be an array`);
  }
  const slugs = new Set();
  for (const icon of Array.isArray(bundle?.icons) ? bundle.icons : []) {
    if (!icon.slug) errors.push('icon slug is required');
    if (slugs.has(icon.slug)) errors.push(`duplicate icon slug ${icon.slug}`);
    slugs.add(icon.slug);
    if (icon.published && !(icon.images?.length > 0)) {
      errors.push(`published icon ${icon.slug} has no images`);
    }
    for (const image of icon.images ?? []) {
      if (!image.src || !image.alt || !(image.width > 0) || !(image.height > 0)) {
        errors.push(`invalid image in icon ${icon.slug}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function publishedIcons(bundle) {
  return (Array.isArray(bundle?.icons) ? bundle.icons : [])
    .filter((icon) => icon.published && icon.images?.length)
    .toSorted((left, right) => left.order - right.order);
}
