// Create-only owner content import. Usage: node scripts/import-wedding-pair-20260912.mjs <folder> <live-snapshot>
import {readFile,writeFile,copyFile,access} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {imageDimensions} from './migrate-icons.mjs';
const root=new URL('../',import.meta.url);
const folder=path.resolve(process.argv[2]);
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const live=await json(path.resolve(process.argv[3]));
const baseline=await json(new URL('public/content/icons.json',root));
const manifest=await json(new URL('public/assets/icons/manifest.json',root));
const title='Господь Вседержитель и Богородица Казанская';
const slug='venchalnaya-para-vsederzhitel-kazanskaya';
const normalized=s=>s.toLowerCase().replace(/[\s.,«»"—-]+/gu,' ').trim();
assert(![...live,...baseline].some(x=>x.slug===slug || x.id===slug || normalized(x.title)===normalized(title)),'Existing card');
const known=new Set(manifest.map(x=>x.sha256));
const texts={};
for(const [key,file] of [['description','Описание.txt'],['moreDetails','Дополнительно.txt']]){
 const bytes=await readFile(path.join(folder,file));
 const value=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/\r\n/g,'\n').trim();
 assert(value.length>0);texts[key]={file,sha256:hash(bytes),value};
}
const originals=[],images=[],pending=[];
for(const [i,sourceFile] of ['photo_5269738934927826055_y.jpg','photo_5269738934927826048_y.jpg'].entries()){
 const from=path.join(folder,sourceFile);const bytes=await readFile(from);const sha256=hash(bytes);
 assert(!known.has(sha256),'Duplicate original photo');known.add(sha256);
 const {width,height}=imageDimensions(bytes);
 const file=slug+(i?'-2':'')+'.jpg';const to=new URL('public/assets/icons/'+file,root);
 await assert.rejects(access(to),'Refusing to overwrite original');pending.push({from,to});
 const asset={id:slug+'-'+(i+1),file,width,height,sourceUrl:'https://iconamaster.ru/assets/icons/'+file,bytes:bytes.length,sha256,
 legacyPath:'/icons/'+slug,role:'original',provenance:'owner-supplied-original-20260912',evidence:['incoming/Новые иконы 1/'+title+'/'+sourceFile]};
 manifest.push(asset);originals.push({sourceFile,...asset});
 images.push({src:'/assets/icons/'+file,alt:title+(i?', вид сбоку':', полный вид пары'),width,height,fit:'contain',position:'50% 50%'});
}
const icon={id:slug,slug,title,published:true,availability:'В наличии',size:'21 × 17 см; киот 35 × 30 см',
 technique:'',origin:'',condition:'',expertise:'',description:texts.description.value,moreDetails:texts.moreDetails.value,
 price:'120 000 руб.',discount:50,newPrice:58000,order:Math.min(...[...baseline,...live].map(x=>Number(x.order)||0))-1,
 type:'',period:'',purpose:'Венчальная',sourceUrl:'https://iconamaster.ru/icons/'+slug,images,previewFit:'contain',previewPosition:'50% 50%'};
for(const {from,to} of pending)await copyFile(from,to,1);
const write=async(rel,value)=>writeFile(new URL(rel,root),JSON.stringify(value,null,2)+'\n');
await write('public/content/icons.json',[icon,...baseline]);
await write('public/assets/icons/manifest.json',manifest);
await write('scripts/data/wedding-pair-20260912.json',[icon]);
await write('reports/wedding-pair-import-20260912.json',{schemaVersion:1,source:'Owner-supplied folder: incoming/Новые иконы 1/'+title,
 priceDecision:'120000 RUB, discount 50 percent and new price 58000 RUB independently specified by owner; no recalculation.',icons:[{title,slug,texts,originals}]});
const report=await json(new URL('reports/icon-migration.json',root));report.assets=manifest;
for(const output of report.outputs){const bytes=await readFile(new URL(output.path,root));output.bytes=bytes.length;output.sha256=hash(bytes);output.records=Object.keys(JSON.parse(bytes)).length;}
Object.assign(report.summary,{localAddedRecords:4,uniqueSlugs:baseline.length+1,publishedRecords:baseline.filter(x=>x.published).length+1,assetFiles:manifest.length,assetBytes:manifest.reduce((s,x)=>s+x.bytes,0)});
await write('reports/icon-migration.json',report);
console.log('Added wedding pair with 2 byte-identical originals; baseline records unchanged. Live records will be preserved during deployment.');
