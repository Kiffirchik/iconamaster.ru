import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  extractEmbeddedPage,
  extractLinks,
  extractLinkedCards,
  extractMediaUrls,
  extractTitle,
  repairMojibake,
} from '../../scripts/lib/legacy-html.mjs';

const fixture = async (name) => readFile(
  new URL(`../fixtures/legacy/${name}`, import.meta.url),
  'utf8',
);

test('extracts sorted unique links from legacy href attributes', async () => {
  assert.deepEqual(extractLinks(await fixture('catalog.html')), [
    '/IKONA-A',
    '/IKONA-B',
    '/IKONY-V-NALICIE',
    'https://iconamaster.cargo.site/VIDEO',
  ]);
});

test('extracts only sorted catalog cards with repaired titles and media evidence', async () => {
  assert.deepEqual(extractLinkedCards(await fixture('catalog.html')), [
    {
      sourcePath: '/IKONA-A',
      title: 'Икона первая',
      mediaUrls: ['//freight.cargo.site/w/350/a.jpg'],
    },
    {
      sourcePath: '/IKONA-B',
      title: 'Вторая икона',
      mediaUrls: ['//freight.cargo.site/w/350/b.jpg'],
    },
  ]);
});

test('extracts sorted unique absolute and root-relative image URLs', async () => {
  assert.deepEqual(extractMediaUrls(await fixture('icon.html')), [
    '/uploads/shop/afull.png',
    '/uploads/shop/bfull.jpg',
    'https://files.cargocollective.com/a.jpg',
  ]);
});

test('extracts decoded title text and repairs only its mojibake segment', async () => {
  assert.equal(
    extractTitle(await fixture('icon.html')),
    'Реставрация & иконы - iconamaster',
  );
});

test('extracts the requested page from embedded Cargo scaffolding JSON', async () => {
  assert.deepEqual(extractEmbeddedPage(await fixture('icon.html'), '/IKONA-EXAMPLE'), {
    title: 'Икона из данных',
    mediaUrls: [
      'https://freight.cargo.site/t/original/i/hash/embedded.jpg',
      'https://freight.cargo.site/t/original/i/other-hash/My%20Icon.JPG',
    ],
  });
  assert.equal(extractEmbeddedPage(await fixture('icon.html'), '/ABSENT'), null);
});

test('rejects unterminated embedded Cargo scaffolding instead of ignoring it', () => {
  assert.throws(
    () => extractEmbeddedPage(
      '<script type="text/json" data-set="ScaffoldingData">{"pages":[]}',
      '/IKONA-EXAMPLE',
    ),
    /Unterminated ScaffoldingData script/,
  );
});

test('does not alter valid Cyrillic while repairing known mojibake', () => {
  assert.equal(repairMojibake('Реставрация икон'), 'Реставрация икон');
  assert.equal(repairMojibake('«Икона» — история'), '«Икона» — история');
  assert.equal(repairMojibake('Р РµСЃС‚Р°РІСЂР°С†РёСЏ'), 'Реставрация');
  assert.equal(repairMojibake('иконС‹ в наличии'), 'иконы в наличии');
  assert.equal(
    repairMojibake('В«РконР°В» вЂ” иСЃС‚ория'),
    '«Икона» — история',
  );
});
