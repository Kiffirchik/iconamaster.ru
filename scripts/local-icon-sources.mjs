import { readFileSync } from 'node:fs';
// Independent owner-provided filenames/hashes retained separately from the public manifest.
export const localIconSources = JSON.parse(readFileSync(
  new URL('../reports/local-icon-import-20260912.json', import.meta.url), 'utf8',
)).icons;
