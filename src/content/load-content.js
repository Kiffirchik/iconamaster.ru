import { validateContentBundle } from './schema.js';

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`failed to load ${url}: ${response.status}`);
  return response.json();
}

export async function loadContent(fetchImpl = fetch) {
  const manifest = await getJson(fetchImpl, '/content/manifest.json');
  const entries = await Promise.all(Object.entries(manifest.files).map(async ([key, file]) => [
    key, await getJson(fetchImpl, `/content/${file}`)
  ]));
  const bundle = { version: manifest.version, ...Object.fromEntries(entries) };
  const validation = validateContentBundle(bundle);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  return bundle;
}
