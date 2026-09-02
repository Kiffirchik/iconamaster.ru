const requiredCollections = ['icons', 'pages', 'articles', 'videos'];
const contactFields = new Set(['whatsapp', 'phone', 'email', 'sourceUrl', 'mapUrl', 'address']);
const addressFields = new Set(['display', 'streetAddress', 'addressLocality', 'addressRegion', 'addressCountry']);
const publicationFields = ['id', 'slug', 'title', 'published', 'order', 'sourceUrl', 'sections'];
const servicePageFields = ['intro', 'template', 'consultationTopic', 'relatedArticleSlug'];
const pageFields = new Set([...publicationFields, ...servicePageFields]);

function validateContacts(contacts, errors) {
  if (!contacts || typeof contacts !== 'object' || Array.isArray(contacts)) {
    errors.push('contacts must be an object');
    return;
  }
  for (const field of Object.keys(contacts)) {
    if (!contactFields.has(field)) errors.push(`contacts contains unknown field ${field}`);
  }
  if (typeof contacts.mapUrl !== 'string') {
    errors.push('contacts field mapUrl must be an HTTPS URL');
  } else {
    try {
      if (new URL(contacts.mapUrl).protocol !== 'https:') errors.push('contacts field mapUrl must be an HTTPS URL');
    } catch {
      errors.push('contacts field mapUrl must be an HTTPS URL');
    }
  }
  const address = contacts.address;
  if (!address || typeof address !== 'object' || Array.isArray(address)) {
    errors.push('contacts address must be an object');
    return;
  }
  for (const field of Object.keys(address)) {
    if (!addressFields.has(field)) errors.push(`contacts address contains unknown field ${field}`);
  }
  for (const field of ['display', 'streetAddress', 'addressLocality', 'addressRegion']) {
    if (typeof address[field] !== 'string' || !address[field].trim()) {
      errors.push(`contacts address field ${field} must be a non-empty string`);
    }
  }
  if (address.addressCountry !== 'RU') errors.push('contacts address field addressCountry must be RU');
}

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
  for (const page of Array.isArray(bundle?.pages) ? bundle.pages : []) {
    const label = `page ${page?.slug ?? '<missing>'}`;
    for (const field of Object.keys(page ?? {})) {
      if (!pageFields.has(field)) errors.push(`${label} contains unknown field ${field}`);
    }
    const servicePage = page?.template === 'service';
    if (servicePage) {
      for (const field of servicePageFields) {
        if (typeof page[field] !== 'string' || !page[field].trim()) {
          errors.push(`${label} field ${field} must be a non-empty string`);
        }
      }
    } else {
      for (const field of servicePageFields) {
        if (Object.hasOwn(page ?? {}, field)) errors.push(`${label} field ${field} is only allowed for service pages`);
      }
    }
  }
  validateContacts(bundle?.contacts, errors);
  return { ok: errors.length === 0, errors };
}

export function publishedIcons(bundle) {
  return (Array.isArray(bundle?.icons) ? bundle.icons : [])
    .filter((icon) => icon.published && icon.images?.length)
    .toSorted((left, right) => left.order - right.order);
}
