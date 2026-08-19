import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { sources } from './icon-sources.mjs';

const outputDirectory = new URL('../public/assets/icons/', import.meta.url);

await mkdir(outputDirectory, { recursive: true });

const manifest = [];
for (const source of sources) {
  const response = await fetch(source.sourceUrl);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!response.ok || !contentType.startsWith('image/')) {
    throw new Error(`Could not download original asset: ${source.file}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(source.file, outputDirectory), bytes);
  manifest.push({
    ...source,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')
  });
}

manifest.sort((left, right) => left.id.localeCompare(right.id));
await writeFile(new URL('manifest.json', outputDirectory), `${JSON.stringify(manifest, null, 2)}\n`);
