import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import test from 'node:test';

test('September 17 articles preserve all original illustrations and readable comparisons', async () => {
  const articles = JSON.parse(await readFile('public/content/articles.json', 'utf8'));
  const report = JSON.parse(await readFile('reports/docx-import.json', 'utf8'));
  for (const [slug, count] of [['icon-painting-pigments',12],['levkas',2],['gold-leaf-gilding',1]]) {
    const matches = articles.filter(a => a.slug === slug);
    assert.equal(matches.length, 1, `${slug}: no missing or duplicate article`);
    const article = matches[0];
    assert.equal(article.published, true);
    assert.match(JSON.stringify(article.sections), /Редакция И\.Ю\./u);
    const images = article.sections.flatMap(s => s.type === 'image' ? [s.image] : s.images ?? []);
    assert.equal(images.length, count);
    assert.equal(new Set(images.map(i => i.src)).size, slug === 'icon-painting-pigments' ? 11 : count);
    for (const image of images) {
      const asset = report.assets.find(a => a.src === image.src && a.ownerSlug === slug);
      assert.ok(asset);
      assert.equal(createHash('sha256').update(await readFile(`public${image.src}`)).digest('hex'), asset.sha256);
    }
  }
  const gold = articles.find(a => a.slug === 'gold-leaf-gilding');
  const comparison = gold.sections.find(s => s.heading === 'Возможность полировки');
  assert.deepEqual(comparison.paragraphs, [
    'Золочение на мордан: Нельзя полировать агатовым зубком',
    'Золочение на полимент: Можно полировать до полного блеска',
  ]);
});
