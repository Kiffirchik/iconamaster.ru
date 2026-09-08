import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { verifyContent, verifyProject } from '../../scripts/verify-content.mjs';

test('DOCX source references are bound to approved articles, never service pages', async () => {
  const bundle = Object.fromEntries(await Promise.all(['icons', 'pages', 'articles', 'videos', 'contacts', 'aliases'].map(async name => [name,
    JSON.parse(await readFile(new URL(`../../public/content/${name}.json`, import.meta.url), 'utf8'))])));
  const errorsFor = candidate => verifyContent(candidate).filter(error => error.includes('sourceUrl'));
  assert.deepEqual(errorsFor(bundle), []);
  const wrongSlug = structuredClone(bundle);
  wrongSlug.articles.find(a => a.slug === 'cast-crosses').sourceUrl = 'docx:history-of-cast-icons.docx';
  assert.ok(errorsFor(wrongSlug).some(e => e.includes('article cast-crosses')));
  const service = structuredClone(bundle);
  service.pages.find(p => p.template === 'service').sourceUrl = 'docx:cast-crosses.docx';
  assert.ok(errorsFor(service).some(e => e.includes('page ')));
});

test('DOCX articles publish complete image sets and preserve the existing monastery URL', async () => {
  const articles = JSON.parse(await readFile(new URL('../../public/content/articles.json', import.meta.url), 'utf8'));
  for (const [slug, count] of [['history-of-cast-icons', 8], ['cast-crosses', 12]]) {
    const matches = articles.filter(a => a.slug === slug);
    assert.equal(matches.length, 1, slug + ' has exactly one article');
    const article = matches[0];
    assert.equal(article.published, true);
    assert.ok(article.sections.filter(s => s.type === 'text').length > 1);
    const images = article.sections.flatMap(s => s.type === 'image' ? [s.image] : s.images ?? []);
    assert.equal(images.length, count, slug + ' preserves all illustrations');
    assert.equal(new Set(images.map(i => i.src)).size, count);
  }
  const monastery = articles.filter(a => a.slug === 'panteleimon-monastery-icons');
  assert.equal(monastery.length, 1);
  assert.match(JSON.stringify(monastery[0].sections), /Богоматерь Шестоковская/);
});

test('all DOCX assets have verified ownership and the expanded publication contract passes', async () => {
  const report = await verifyProject(new URL('../../', import.meta.url));
  assert.deepEqual(report.errors, []);
  assert.equal(report.summary.articles, 12);
});
