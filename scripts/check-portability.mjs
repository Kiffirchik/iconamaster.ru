#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRepositoryPortability } from './lib/portability.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const findings = await checkRepositoryPortability({ root });
if (findings.length) {
  for (const item of findings) console.error(`${item.path}:${item.line} [${item.kind}] ${item.match}`);
  console.error(`Portability check failed with ${findings.length} finding(s).`);
  process.exitCode = 1;
} else {
  console.log('Portability check passed.');
}
