import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const articlesUrl = new URL('../../public/content/articles.json', import.meta.url);

const readJpegDimensions = async (url) => {
  const bytes = await readFile(url);
  let offset = 2;

  while (offset < bytes.length) {
    assert.equal(bytes[offset], 0xff, `${url.pathname} contains a valid JPEG marker`);
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    offset += length + 2;
  }

  assert.fail(`${url.pathname} is missing JPEG dimensions`);
};

test('publishes both imported Dzen stories with full structured content', async () => {
  const articles = JSON.parse(await readFile(articlesUrl, 'utf8'));
  const expected = [
    ['restoration-murals-cleaning', 'https://dzen.ru/a/ak_PywErdWEdTZrn', 3],
    ['georgievsky-church-iconostasis', 'https://dzen.ru/a/aVK_H2_G1yJNnCC5', 11],
  ];

  for (const [slug, sourceUrl, minimumImages] of expected) {
    const article = articles.find((candidate) => candidate.slug === slug);
    assert.ok(article, `${slug} is published`);
    assert.equal(article.sourceUrl, sourceUrl);
    assert.equal(article.published, true);
    assert.ok(article.summary?.trim());
    assert.ok(article.sections.filter((section) => section.type === 'text').length >= 2);
    const imageCount = article.sections.reduce((count, section) => {
      if (section.type === 'image' && section.image?.src) return count + 1;
      if (section.type === 'gallery') return count + (section.images ?? []).filter((image) => image?.src).length;
      return count;
    }, 0);
    assert.ok(imageCount >= minimumImages, `${slug} keeps its source imagery`);
  }
});

test('preserves the portrait rotation applied to two iconostasis photographs in the source DOCX', async () => {
  const articles = JSON.parse(await readFile(articlesUrl, 'utf8'));
  const article = articles.find((candidate) => candidate.slug === 'georgievsky-church-iconostasis');
  const expected = [
    ['/assets/articles/dzen/georgievsky-church-iconostasis-5-upright.jpg', 1070, 1429],
    ['/assets/articles/dzen/georgievsky-church-iconostasis-6-upright.jpg', 815, 1088],
  ];

  for (const [src, width, height] of expected) {
    const section = article.sections.find((candidate) => candidate.type === 'image' && candidate.image?.src === src);
    assert.ok(section, `${src} remains in the article`);
    assert.deepEqual(
      { width: section.image.width, height: section.image.height },
      { width, height },
      `${src} metadata keeps the DOCX rotation`,
    );
    assert.deepEqual(
      await readJpegDimensions(new URL(`../../public${src}`, import.meta.url)),
      { width, height },
      `${src} pixels keep the DOCX rotation`,
    );
  }
});
