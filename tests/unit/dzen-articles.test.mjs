import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const articlesUrl = new URL('../../public/content/articles.json', import.meta.url);

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
