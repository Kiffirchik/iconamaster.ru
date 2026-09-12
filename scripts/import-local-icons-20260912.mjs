// One-time, create-only content import; originals are copied byte-for-byte.
// Usage: node scripts/import-local-icons-20260912.mjs <input-root> <live-icons-snapshot>
import { readFile, writeFile, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { imageDimensions } from './migrate-icons.mjs';

const root = new URL('../', import.meta.url);
const input = path.resolve(process.argv[2]);
const readJson = async p => JSON.parse(await readFile(p, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const specs = [
  ['Ангел Хранитель', 'angel-khranitel-kiot', ['6044', '6058', '6043', '6045', '6062', '6065']],
  ['Господь Вседержитель', 'gospod-vsederzhitel-kiot', ['6053', '6050', '6051', '6052', '6054']],
  ['Пантелеймон Целитель', 'panteleimon-tselitel-kiot', ['6169', '6063', '6168']],
];
const live = await readJson(path.resolve(process.argv[3]));
const manifest = await readJson(new URL('public/assets/icons/manifest.json', root));
const knownHashes = new Set(manifest.map(x => x.sha256));
const rows = [], sources = [], pending = [];
for (const [title, slug, suffixes] of specs) {
  assert(!live.some(x => x.slug === slug || x.id === slug), `Existing card: ${slug}`);
  const texts = {};
  for (const [field, file] of [['description', 'Описание.txt'], ['moreDetails', 'Дополнительно.txt']]) {
    const bytes = await readFile(path.join(input, title, file));
    const value = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n/g, '\n').trim();
    assert(value.length > 0);
    texts[field] = { file, sha256: hash(bytes), value };
  }
  const images = [], originals = [];
  for (const [i, suffix] of suffixes.entries()) {
    const sourceFile = `photo_526973893492782${suffix}_y.jpg`;
    const from = path.join(input, title, sourceFile);
    const bytes = await readFile(from);
    const sha256 = hash(bytes);
    assert(!knownHashes.has(sha256), `Duplicate image ${sourceFile}`);
    knownHashes.add(sha256);
    const { width, height } = imageDimensions(bytes);
    const file = `${slug}${i ? `-${i + 1}` : ''}.jpg`;
    const to = new URL(`public/assets/icons/${file}`, root);
    await assert.rejects(access(to), `Refusing to overwrite ${file}`);
    pending.push({ from, to });
    const sourceUrl = `https://iconamaster.ru/assets/icons/${file}`;
    const asset = { id: `${slug}-${i + 1}`, file, width, height, sourceUrl,
      bytes: bytes.length, sha256, legacyPath: `/icons/${slug}`, role: 'original',
      provenance: 'owner-supplied-original-20260912', evidence: [`incoming/Новые иконы 1/${title}/${sourceFile}`] };
    manifest.push(asset);
    originals.push({ sourceFile, ...asset });
    images.push({ src: `/assets/icons/${file}`, alt: `${title}, ${i ? `дополнительный вид ${i}` : 'полный вид'}`,
      width, height, fit: 'contain', position: '50% 50%' });
  }
  rows.push({ id: slug, slug, title, published: true, availability: 'В наличии',
    size: '21 × 17 см; киот 35 × 30 см', technique: '', origin: '', condition: '', expertise: '',
    description: texts.description.value, moreDetails: texts.moreDetails.value,
    price: '60 000 руб.', discount: 50, newPrice: 29000,
    order: Math.min(...live.map(x => Number(x.order) || 0)) - 3 + rows.length,
    type: '', period: '', purpose: '', sourceUrl: `https://iconamaster.ru/icons/${slug}`,
    images, previewFit: 'contain', previewPosition: '50% 50%' });
  sources.push({ title, slug, texts, originals });
}
// All inputs/collisions checked before any write; no original is ever overwritten.
for (const { from, to } of pending) await copyFile(from, to, 1);
const writeJson = async (rel, value) => writeFile(new URL(rel, root), JSON.stringify(value, null, 2) + '\n');
await writeJson('public/content/icons.json', [...rows, ...live]);
await writeJson('public/assets/icons/manifest.json', manifest);
await writeJson('reports/local-icon-import-20260912.json', { schemaVersion: 1,
  source: 'Owner-supplied folders: incoming/Новые иконы 1',
  priceDecision: '50 percent and 29000 RUB are independently supplied; no automatic recalculation.',
  icons: sources });
await writeJson('scripts/data/new-icons-20260912.json', rows);
const report = await readJson(new URL('reports/icon-migration.json', root));
report.assets = manifest;
for (const output of report.outputs) {
  const bytes = await readFile(new URL(output.path, root));
  output.bytes = bytes.length; output.sha256 = hash(bytes);
  output.records = Object.keys(JSON.parse(bytes)).length;
}
Object.assign(report.summary, { localAddedRecords: 3, uniqueSlugs: live.length + 3,
  publishedRecords: live.filter(x => x.published).length + 3,
  assetFiles: manifest.length, assetBytes: manifest.reduce((s, a) => s + a.bytes, 0) });
await writeJson('reports/icon-migration.json', report);
console.log(`Added ${rows.length} icons, ${pending.length} unchanged originals; preserved all ${live.length} live records.`);
