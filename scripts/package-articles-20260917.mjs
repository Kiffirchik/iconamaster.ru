// Narrow content-only payload; rejects unrelated route or content changes.
import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const slugs=['icon-painting-pigments','levkas','gold-leaf-gilding'];
const root='dist/client';
const destination='.release-artifacts/articles-payload-20260917';
const read=p=>readFile(p,'utf8');
const baseline=JSON.parse(await read('.release-artifacts/articles-before-20260917.json'));
const articles=JSON.parse(await read(`${root}/content/articles.json`));
assert.deepEqual(articles.slice(3),baseline);
assert.deepEqual(articles.slice(0,3).map(a=>a.slug),slugs);
const routes=JSON.parse(await read(`${root}/.live-templates/routes.json`));
const previousRoutes={...routes};slugs.forEach(s=>delete previousRoutes[`/articles/${s}`]);
assert.deepEqual(previousRoutes,JSON.parse(await read('.release-artifacts/routes-before-20260917.json')));
const apache=await read(`${root}/.htaccess`);
assert.equal(apache.split('\n').filter(line=>!slugs.some(s=>line.includes(`articles/${s}`))).join('\n'),await read('.release-artifacts/apache-before-20260917.txt'));
const sitemap=await read(`${root}/.live-templates/sitemap.xml`);
const previousMap=await read('.release-artifacts/sitemap-before-20260917.xml');
const locations=xml=>Array.from(xml.matchAll(/<loc>(.*?)<\/loc>/g),m=>m[1]).sort();
assert.deepEqual(locations(sitemap).filter(url=>!slugs.some(s=>url===`https://iconamaster.ru/articles/${s}`)),locations(previousMap));
const report=JSON.parse(await read('reports/docx-import.json'));
const assets=report.assets.filter(a=>slugs.includes(a.ownerSlug));
assert.equal(assets.length,14);
const files=['.htaccess','content/articles.json','.live-templates/routes.json','.live-templates/sitemap.xml',
  ...['/articles',...slugs.map(s=>`/articles/${s}`)].flatMap(route=>[`${route.slice(1)}/index.html`,`.live-templates/${routes[route]}`]),
  ...assets.map(a=>a.src.slice(1))];
await assert.rejects(access(destination));
for(const file of files){await mkdir(path.dirname(path.join(destination,file)),{recursive:true});await copyFile(path.join(root,file),path.join(destination,file));}
await writeFile('.release-artifacts/articles-20260917-files.json',JSON.stringify(files,null,2)+'\n');
console.log({destination,files:files.length,images:assets.length});
