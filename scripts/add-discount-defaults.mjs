import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// An additive migration: never overwrite an existing discount or price.
const iconsPath = new URL('../public/content/icons.json', import.meta.url);
const rows = JSON.parse(await readFile(iconsPath, 'utf8'));
for (const row of rows) {
  if (!Object.hasOwn(row, 'discount')) row.discount = null;
  if (!Object.hasOwn(row, 'newPrice')) row.newPrice = null;
}
const bytes = `${JSON.stringify(rows, null, 2)}\n`;
await writeFile(iconsPath, bytes);
const reportPath = new URL('../reports/icon-migration.json', import.meta.url);
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const output = report.outputs.find(x => x.path === 'public/content/icons.json');
output.bytes = Buffer.byteLength(bytes);
output.sha256 = createHash('sha256').update(bytes).digest('hex');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Added nullable discount fields to ${rows.length} icons.`);
