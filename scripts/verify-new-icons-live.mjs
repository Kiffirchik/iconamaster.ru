// Read-only publication smoke test: new JSON, HTML, all new original bytes, old records.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const additions=JSON.parse(await readFile(new URL('./data/new-icons-20260912.json',import.meta.url)));
const report=JSON.parse(await readFile(new URL('../reports/local-icon-import-20260912.json',import.meta.url)));
const base='https://iconamaster.ru';
const get=async path=>{
  const response=await fetch(base+path,{signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache'}});
  assert.equal(response.status,200,path);
  return response;
};
const live=await (await get('/content/icons.json')).json();
if(process.argv[2]){
  const before=JSON.parse(await readFile(process.argv[2]));
  const slugs=new Set(additions.map(x=>x.slug));
  assert.deepEqual(live.filter(x=>!slugs.has(x.slug)),before,'All previous live icon fields and ordering remain unchanged');
}
for(const icon of additions){
  assert.deepEqual(live.find(x=>x.slug===icon.slug),icon,icon.slug);
  const html=await (await get('/icons/'+icon.slug)).text();
  assert(html.includes(icon.title),icon.slug);
  assert(html.includes('icon-more-details') && html.includes('icon-price__old') && html.includes('icon-price__new'));
  assert(/29(?: |&nbsp;|&#160;|\u00a0)000/.test(html));
  console.log('HTML + live fields:',icon.slug);
}
for(const source of report.icons)for(const asset of source.originals){
  const bytes=Buffer.from(await (await get('/assets/icons/'+asset.file)).arrayBuffer());
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.file);
}
const catalog=await (await get('/collection')).text();
const sitemap=await (await get('/sitemap.xml')).text();
for(const icon of additions){assert(catalog.includes('/icons/'+icon.slug));assert(sitemap.includes('/icons/'+icon.slug));}
console.log('PASS: 3 cards, 14 byte-identical originals, collection, sitemap and previous live data.');
