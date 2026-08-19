import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../public/assets/icons/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));

for (const asset of manifest) {
  const bytes = await readFile(new URL(asset.file, root));
  const actualBytes = bytes.length;
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualBytes !== asset.bytes || actualHash !== asset.sha256) {
    throw new Error(`Original asset mismatch: ${asset.file}`);
  }
}

console.log(`verified ${manifest.length} original icon assets`);
