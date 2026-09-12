import { readFileSync } from 'node:fs';
// Independent owner-provided filenames/hashes retained separately from the public manifest.
export const localIconSources = ['local-icon-import-20260912.json','wedding-pair-import-20260912.json'].flatMap(file =>
  JSON.parse(readFileSync(new URL('../reports/'+file, import.meta.url), 'utf8')).icons);
