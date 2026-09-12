import test from 'node:test';
import assert from 'node:assert/strict';
import { compileLiveTemplate, prepareLiveEditor } from '../../scripts/prepare-live-editor.mjs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('live slots preserve wrappers, nested markup boundaries and unrelated content', () => {
  const html = '<main><div data-live-slot="icon-card:sample"><h3>Old</h3><div>x</div></div><div>keep</div><header data-live-slot="article-header:news"><h1>Old</h1></header></main>';
  assert.equal(compileLiveTemplate(html), '<main><div data-live-slot="icon-card:sample"><!--LIVE:icon-card:sample--></div><div>keep</div><header data-live-slot="article-header:news"><!--LIVE:article-header:news--></header></main>');
});
test('live compiler fails closed on unclosed or nested slots', () => {
  assert.throws(() => compileLiveTemplate('<div data-live-slot="icon-card:sample">'), /Unclosed/);
  assert.throws(() => compileLiveTemplate('<div data-live-slot="icon-card:sample"><div data-live-slot="passport:sample"></div></div>'), /Nested/);
});

test('visibility boundaries include the whole card and its image, not only its text', () => {
  const html = '<main><article data-live-visible="sample"><img src="/original.jpg"/><div data-live-slot="icon-card:sample">Old</div></article><p>Keep</p></main>';
  assert.equal(compileLiveTemplate(html), '<main><!--VISIBLE:sample--><article data-live-visible="sample"><img src="/original.jpg"/><div data-live-slot="icon-card:sample"><!--LIVE:icon-card:sample--></div></article><!--/VISIBLE:sample--><p>Keep</p></main>');
});

test('MTW publishes a stable sitemap index pointing to the uncached live PHP endpoint', async context => {
  const root=await mkdtemp(path.join(tmpdir(),'iconamaster-visibility-'));
  context.after(()=>rm(root,{recursive:true,force:true}));
  for(const dir of ['content','collection','articles'])await mkdir(path.join(root,dir));
  for(const route of ['','collection','articles'])await writeFile(path.join(root,route,'index.html'),'<main><h1>Site</h1></main>');
  for(const kind of ['icons','articles'])await writeFile(path.join(root,'content',kind+'.json'),'[]');
  await writeFile(path.join(root,'.htaccess'),'RewriteEngine On\n');
  await writeFile(path.join(root,'robots.txt'),'User-agent: *\nSitemap: https://iconamaster.ru/sitemap.xml\n');
  const xml='<urlset><url><loc>https://iconamaster.ru/collection</loc></url></urlset>';
  await writeFile(path.join(root,'sitemap.xml'),xml);
  await prepareLiveEditor(root);
  assert.equal(await readFile(path.join(root,'.live-templates','sitemap.xml'),'utf8'),xml);
  const index=await readFile(path.join(root,'sitemap.xml'),'utf8');
  assert.match(index,/<sitemapindex/);
  assert.match(index,/<loc>https:\/\/iconamaster.ru\/content-sitemap.php<\/loc>/);
  assert.doesNotMatch(index,/<url>/);
  assert.match(await readFile(path.join(root,'robots.txt'),'utf8'),/Sitemap: https:\/\/iconamaster.ru\/content-sitemap.php/);
});
