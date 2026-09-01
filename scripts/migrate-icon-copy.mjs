import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { extractIconCopy } from './lib/legacy-html.mjs';

const projectDirectory = new URL('../', import.meta.url);
const iconsUrl = new URL('../public/content/icons.json', import.meta.url);
const reportUrl = new URL('../reports/icon-migration.json', import.meta.url);
const sourceFlag = process.argv.indexOf('--source');
const sourceArgument = sourceFlag >= 0 ? process.argv[sourceFlag + 1] : undefined;

if (!sourceArgument) {
  throw new Error('Usage: node scripts/migrate-icon-copy.mjs --source <archive-directory>');
}

const sourceDirectory = path.resolve(sourceArgument);
if (!(await stat(sourceDirectory)).isDirectory()) {
  throw new Error(`Source is not a directory: ${sourceDirectory}`);
}

const localPage = async (sourcePath) => {
  const file = path.join(sourceDirectory, sourcePath.slice(1), 'index.html');
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
};

const publicPage = async (sourcePath) => {
  const url = new URL(sourcePath, 'https://iconamaster.cargo.site');
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
    headers: { 'user-agent': 'IconamasterContentMigration/1.0' },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  return response.text();
};

const icons = JSON.parse(await readFile(iconsUrl, 'utf8'));
const migrated = [];
let publicFallbacks = 0;

for (const icon of icons) {
  const sourcePath = new URL(icon.sourceUrl).pathname;
  let html = await localPage(sourcePath);
  let copy = html ? extractIconCopy(html) : { price: null, description: '' };

  if (!copy.price && !copy.description) {
    html = await publicPage(sourcePath);
    copy = extractIconCopy(html);
    publicFallbacks += 1;
  }

  if (!copy.price && !copy.description) {
    throw new Error(`No price or description found for ${sourcePath}`);
  }

  migrated.push({
    ...icon,
    price: copy.price,
    description: copy.description,
  });
}

const iconsJson = `${JSON.stringify(migrated, null, 2)}\n`;
const report = JSON.parse(await readFile(reportUrl, 'utf8'));
const iconsOutput = report.outputs.find(({ id }) => id === 'icons');
if (!iconsOutput) throw new Error('Icon migration report has no icons output');
iconsOutput.bytes = Buffer.byteLength(iconsJson);
iconsOutput.sha256 = createHash('sha256').update(iconsJson).digest('hex');

await Promise.all([
  writeFile(iconsUrl, iconsJson, 'utf8'),
  writeFile(reportUrl, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
]);
console.log(JSON.stringify({
  records: migrated.length,
  listedPrices: migrated.filter(({ price }) => price).length,
  descriptions: migrated.filter(({ description }) => description).length,
  publicFallbacks,
  output: new URL('public/content/icons.json', projectDirectory).pathname,
}, null, 2));
