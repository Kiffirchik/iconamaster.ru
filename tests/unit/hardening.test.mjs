import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../../src/', import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('uses image metadata for every visible image frame and reserves the hero ratio', async () => {
  const [image, gallery, home, styles] = await Promise.all([
    source('components/IconImage.jsx'),
    source('components/IconGallery.jsx'),
    source('pages/HomePage.jsx'),
    source('styles.css')
  ]);

  assert.match(image, /aspectRatio:\s*`\$\{image\.width\}\s*\/\s*\$\{image\.height\}`/);
  assert.match(gallery, /style=\{\{\s*aspectRatio:\s*`\$\{image\.width\}\s*\/\s*\$\{image\.height\}`\s*\}\}/);
  assert.match(home, /style=\{\{\s*aspectRatio:\s*`\$\{heroIcon\.images\[0\]\.width\}\s*\/\s*\$\{heroIcon\.images\[0\]\.height\}`\s*\}\}/);
  assert.doesNotMatch(styles, /aspect-ratio:\s*3\s*\/\s*4/);
});

test('keeps only the hero eager and avoids fixed page overlays', async () => {
  const [image, home, styles] = await Promise.all([
    source('components/IconImage.jsx'),
    source('pages/HomePage.jsx'),
    source('styles.css')
  ]);

  assert.match(image, /loading=\{eager \? 'eager' : 'lazy'\}/);
  assert.match(image, /fetchPriority=\{eager \? 'high' : 'auto'\}/);
  assert.match(home, /<IconImage[^>]*mode="full" eager\s*\/>/);
  assert.doesNotMatch(styles, /position:\s*fixed/);
});
