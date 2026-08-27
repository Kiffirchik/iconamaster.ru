import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  extractEmbeddedPage,
  extractLinks,
  extractLinkedCards,
  extractMediaEntries,
  extractMediaUrls,
  extractTitle,
  getMediaDisposition,
  partitionContractedLinks,
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
      media: [{
        url: '//freight.cargo.site/w/350/a.jpg',
        role: 'thumbnail',
        provenance: 'catalog-card',
      }],
    },
    {
      sourcePath: '/IKONA-B',
      title: 'Вторая икона',
      media: [{
        url: '//freight.cargo.site/w/350/b.jpg',
        role: 'thumbnail',
        provenance: 'catalog-card',
      }],
    },
  ]);
});

test('labels media roles and provenance without requiring downstream URL inference', () => {
  const html = [
    '<img data-src="https://freight.cargo.site/t/original/i/hash/icon.jpg">',
    '<img data-lazy-src="https://freight.cargo.site/w/350/i/hash/icon.jpg">',
    '<img src="https://freight.cargo.site/w/441/i/hash/icon.jpg">',
  ].join('');

  assert.deepEqual(extractMediaEntries(html, 'local-page-html'), [
    {
      url: 'https://freight.cargo.site/t/original/i/hash/icon.jpg',
      role: 'original',
      provenance: 'local-page-html',
    },
    {
      url: 'https://freight.cargo.site/w/350/i/hash/icon.jpg',
      role: 'thumbnail',
      provenance: 'local-page-html',
    },
    {
      url: 'https://freight.cargo.site/w/441/i/hash/icon.jpg',
      role: 'page-media',
      provenance: 'local-page-html',
    },
  ]);
});

test('keeps thumbnail-only icons unpublished until public or Cargo recovery', () => {
  assert.deepEqual(getMediaDisposition([{
    url: '//freight.cargo.site/w/350/i/hash/icon.jpg',
    role: 'thumbnail',
    provenance: 'catalog-card',
  }]), {
    mediaRecovery: 'required-public-or-cargo',
    publicationStatus: 'unpublished',
  });
  assert.deepEqual(getMediaDisposition([{
    url: 'https://freight.cargo.site/t/original/i/hash/icon.jpg',
    role: 'original',
    provenance: 'local-page-html',
  }]), {
    mediaRecovery: 'not-required',
    publicationStatus: 'pending-validation',
  });
});

test('requires every explicitly excluded link and rejects uncontracted observations', () => {
  assert.deepEqual(
    partitionContractedLinks(['/ARTICLE-A', '/ARTICLE-EXCLUDED'], {
      included: ['/ARTICLE-A'],
      excluded: ['/ARTICLE-EXCLUDED'],
    }),
    {
      included: ['/ARTICLE-A'],
      excluded: ['/ARTICLE-EXCLUDED'],
    },
  );
  assert.throws(
    () => partitionContractedLinks(['/ARTICLE-A'], {
      included: ['/ARTICLE-A'],
      excluded: ['/ARTICLE-EXCLUDED'],
    }),
    /Contracted links mismatch/,
  );
  assert.throws(
    () => partitionContractedLinks(['/ARTICLE-A', '/ARTICLE-EXCLUDED', '/SURPRISE'], {
      included: ['/ARTICLE-A'],
      excluded: ['/ARTICLE-EXCLUDED'],
    }),
    /Contracted links mismatch/,
  );
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
    media: [
      {
        url: 'https://freight.cargo.site/t/original/i/hash/embedded.jpg',
        role: 'original',
        provenance: 'cargo-scaffolding-content',
      },
      {
        url: 'https://freight.cargo.site/t/original/i/other-hash/My%20Icon.JPG',
        role: 'original',
        provenance: 'cargo-scaffolding-images',
      },
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
  assert.equal(repairMojibake('В Москве'), 'В Москве');
  assert.equal(repairMojibake('вариант «В»'), 'вариант «В»');
  assert.equal(repairMojibake('«Икона» — история'), '«Икона» — история');
  assert.equal(repairMojibake('Р РµСЃС‚Р°РІСЂР°С†РёСЏ'), 'Реставрация');
  assert.equal(repairMojibake('иконС‹ в наличии'), 'иконы в наличии');
  assert.equal(
    repairMojibake('В«РконР°В» вЂ” иСЃС‚ория'),
    '«Икона» — история',
  );
});
