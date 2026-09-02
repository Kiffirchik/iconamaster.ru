import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectFile = (relativePath) => new URL(`../../${relativePath}`, import.meta.url);

test('document metadata identifies the workshop and uses its local favicon', async () => {
  const html = await readFile(projectFile('index.html'), 'utf8');

  assert.match(html, /<html\s+lang="ru">/u);
  assert.match(html, /<title>Иконописная мастерская<\/title>/u);
  assert.match(html, /<link\s+rel="icon"\s+type="image\/svg\+xml"\s+href="\/favicon\.svg"\s*\/>/u);
  assert.match(html, /<!-- ICONAMASTER_SEO -->/u);
  assert.match(html, /<!-- ICONAMASTER_ANALYTICS -->/u);
  assert.match(html, /<!-- ICONAMASTER_APP -->/u);
  assert.match(html, /<!-- ICONAMASTER_NOSCRIPT -->/u);
  assert.doesNotMatch(html, /Prototype/u);
});

test('favicon is a compact local SVG with an arch and Orthodox cross', async () => {
  const svg = await readFile(projectFile('public/favicon.svg'), 'utf8');

  assert.match(svg, /<svg\b[^>]*viewBox="0 0 64 64"/u);
  assert.match(svg, /<path\b[^>]*data-symbol="arch"/u);
  assert.match(svg, /<path\b[^>]*data-symbol="orthodox-cross"/u);
  assert.doesNotMatch(svg, /<text\b/iu);
});
