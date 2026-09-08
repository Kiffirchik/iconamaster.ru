import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {imageDimensions} from './migrate-icons.mjs';

const root=new URL('../',import.meta.url);
const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
const write=async(name,data)=>writeFile(new URL(name,root),JSON.stringify(data,null,2)+'\n','utf8');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const [snapshot,decisions,metadata,oldIcons,oldManifest,oldAliases,fixture]=await Promise.all([
  read('scripts/data/cargo-catalog-20260908.json'),read('scripts/data/cargo-duplicate-decisions.json'),
  read('scripts/data/cargo-reviewed-metadata.json'),read('public/content/icons.json'),
  read('public/assets/icons/manifest.json'),read('public/content/aliases.json'),read('tests/fixtures/migration/icon-inventory.json'),
]);
const cache=process.argv.includes('--offline')?{results:[],failures:[]}:await read('tmp/cargo-asset-cache.json').catch(()=>({results:[],failures:[]}));
const duplicateIds=new Set(decisions.cardDuplicates.map(d=>d.sourceId));
const publicCards=snapshot.cards.filter(c=>c.published&&!duplicateIds.has(c.id));
const bySource=new Map(oldIcons.map(i=>[i.sourceUrl,i]));
const manifestBySource=new Map(oldManifest.map(a=>[a.sourceUrl,a]));
const cachedBySource=new Map(cache.results.map(a=>[a.sourceUrl,a]));
const fixtureByPath=new Map(fixture.icons.map(i=>[i.sourcePath,i]));
const icons=[];const manifest=[...oldManifest];const assetsToCopy=[];const exclusions=[];
const mappings=[];const aliases={...oldAliases};
const oldOrders=oldIcons.map(i=>i.order);let nextOrder=Math.max(...oldOrders)+1;

for(const card of publicCards){
  const previous=bySource.get(card.sourceUrl);
  const reviewed=metadata[String(card.id)];
  if(!reviewed)throw new Error(`Missing reviewed metadata: ${card.id}`);
  for(const field of ['period','purpose','size']){
    if(typeof reviewed[field]!=='string')throw new Error(`Invalid ${field}: ${card.id}`);
    if(reviewed[field]&&!reviewed.evidence?.[field])throw new Error(`Unsupported ${field}: ${card.id}`);
    const normalize=value=>value.replace(/\s+/gu,' ').trim();
    if(reviewed[field]&&!normalize(`${card.title} ${card.originalText}`).includes(normalize(reviewed.evidence[field])))throw new Error(`Evidence not in original ${field}: ${card.id}`);
  }
  const slug=previous?.slug??card.sourcePath.slice(1).toLowerCase();
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))throw new Error(`Unsafe slug ${slug}`);
  const title=previous?.title??card.title.replace(/\s+copy$/iu,'');
  const images=[...(previous?.images??[])];
  const seenHashes=new Map(images.map(i=>{
    const asset=oldManifest.find(a=>`/assets/icons/${a.file}`===i.src);
    if(!asset)throw new Error(`Missing existing asset ${i.src}`);
    return [asset.sha256,asset.sourceUrl];
  }));
  const sourceFixture=fixtureByPath.get(card.sourcePath)??{sourcePath:card.sourcePath,sourceUrl:card.sourceUrl,title,mediaRecovery:'not-required',originals:[]};
  for(const original of card.originals){
    if(manifestBySource.has(original.sourceUrl))continue;
    if(decisions.unavailableImageIds.includes(original.id)){
      exclusions.push({cardId:card.id,imageId:original.id,sourceUrl:original.sourceUrl,reason:decisions.unavailableImageReason});continue;
    }
    const duplicate=decisions.photoDuplicates?.find(d=>d.cardId===card.id&&d.imageId===original.id);
    if(duplicate){
      const retained=manifestBySource.get(duplicate.retainedSourceUrl);
      if(!retained||!images.some(i=>i.src===`/assets/icons/${retained.file}`))throw new Error(`Duplicate photo has no owned canonical image: ${original.id}`);
      const bytes=await readFile(new URL(`public/assets/icons/${retained.file}`,root));
      if(digest(bytes)!==retained.sha256)throw new Error(`Retained duplicate photo changed: ${original.id}`);
      exclusions.push({cardId:card.id,imageId:original.id,sourceUrl:original.sourceUrl,reason:'Byte-identical photo already retained',retainedSourceUrl:duplicate.retainedSourceUrl});continue;
    }
    const cached=cachedBySource.get(original.sourceUrl);
    if(!cached)throw new Error(`Download required for ${card.id}/${original.id}`);
    if(seenHashes.has(cached.sha256)){
      exclusions.push({cardId:card.id,imageId:original.id,sourceUrl:original.sourceUrl,reason:'Byte-identical photo already retained',retainedSourceUrl:seenHashes.get(cached.sha256)});continue;
    }
    const filename=`${slug}-cargo-${original.id}.jpg`;
    const bytes=await readFile(new URL(`tmp/cargo-originals/${cached.file}`,root));
    if(digest(bytes)!==cached.sha256)throw new Error(`Cached original checksum changed: ${original.id}`);
    const dimensions=imageDimensions(bytes);
    if(dimensions.width!==original.width||dimensions.height!==original.height)throw new Error(`Original dimensions changed: ${original.id}`);
    const asset={id:`${slug}-cargo-${original.id}`,file:filename,...dimensions,sourceUrl:original.sourceUrl,bytes:bytes.length,sha256:cached.sha256,legacyPath:card.sourcePath,role:'original',provenance:original.provenance,evidence:[original.provenance]};
    manifest.push(asset);manifestBySource.set(asset.sourceUrl,asset);seenHashes.set(asset.sha256,asset.sourceUrl);
    images.push({src:`/assets/icons/${filename}`,alt:`${title}, ${images.length===0?'полный вид':`дополнительный вид ${images.length}`}`,...dimensions,fit:'contain',position:'50% 50%'});
    assetsToCopy.push([new URL(`tmp/cargo-originals/${cached.file}`,root),new URL(`public/assets/icons/${filename}`,root)]);
    if(!sourceFixture.originals.some(a=>a.sourceUrl===original.sourceUrl))sourceFixture.originals.push({sourceUrl:original.sourceUrl,provenance:original.provenance});
  }
  if(!images.length)throw new Error(`Cannot publish empty card ${card.id}`);
  let description=previous?.description||card.description;
  // These two old extracts lost the heading's object date / frame description.
  if([8994424,9006482].includes(card.id))description=card.description;
  // Keep the raw source typo in the snapshot, not the public description.
  if(card.id===9161198)description=description.replace(/20\s+000\s+тыс\.?\s*руб\.?/iu,'').trim();
  const correctedSize=decisions.ownerConfirmedSizes?.find(s=>s.sourceId===card.id);
  if(correctedSize)description=description.replace(correctedSize.descriptionFrom,correctedSize.descriptionTo);
  const size=correctedSize?.size??reviewed.size;
  const isSold=/(?:^|[\s.])Продан[ао]?\.?/iu.test(card.originalText);
  const confirmedPrice=decisions.ownerConfirmedPrices?.find(p=>p.sourceId===card.id)?.price;
  const price=confirmedPrice==null?previous?.price??card.price:`${String(confirmedPrice).replace(/\B(?=(\d{3})+(?!\d))/gu,' ')} руб.`;
  const clean=value=>/уточняется|по запросу|при консультации/iu.test(value??'')?'':(value??'');
  icons.push({...(previous??{}),id:previous?.id??slug,slug,title,published:true,
    availability:isSold?'Продано':(previous?.availability??''),size,purpose:reviewed.purpose,
    technique:clean(previous?.technique),origin:'',condition:clean(previous?.condition),expertise:clean(previous?.expertise),
    description,price,order:previous?.order??nextOrder++,type:'',period:reviewed.period,
    sourceUrl:card.sourceUrl,images,previewFit:'contain',previewPosition:previous?.previewPosition??'50% 50%'});
  mappings.push({legacyPath:card.sourcePath,slug,type:'',period:reviewed.period,purpose:reviewed.purpose,published:true});
  fixtureByPath.set(card.sourcePath,sourceFixture);
  aliases[card.sourcePath]=`/icons/${slug}`;
}
for(const decision of decisions.cardDuplicates.filter(d=>d.redirect)){
  const source=snapshot.cards.find(c=>c.id===decision.sourceId);
  const canonical=snapshot.cards.find(c=>c.id===decision.canonicalId);
  const target=icons.find(i=>i.sourceUrl===canonical.sourceUrl);
  if(!target)throw new Error('Duplicate canonical record missing');
  aliases[source.sourcePath]=`/icons/${target.slug}`;
}
if(new Set(icons.map(i=>i.slug)).size!==icons.length)throw new Error('Duplicate canonical slug');
if(oldIcons.some(i=>!icons.some(n=>n.slug===i.slug)))throw new Error('Import would remove an existing card; review required');
const sourcePaths=new Set(publicCards.map(c=>c.sourcePath));
fixture.icons=[...fixtureByPath.values()].filter(i=>sourcePaths.has(i.sourcePath)).sort((a,b)=>a.sourcePath.localeCompare(b.sourcePath));
fixture.supplementalSource={snapshot:'scripts/data/cargo-catalog-20260908.json',observedAt:snapshot.observedAt};
const report={schemaVersion:1,observedAt:snapshot.observedAt,sourceCards:snapshot.cards.length,sourcePublished:snapshot.cards.filter(c=>c.published).length,
  publishedCards:icons.length,originalAssets:manifest.length,cardDuplicates:decisions.cardDuplicates,possibleDuplicates:decisions.possibleDuplicates??[],ownerConfirmedPrices:decisions.ownerConfirmedPrices??[],ownerConfirmedSizes:decisions.ownerConfirmedSizes??[],imageExclusions:exclusions,
  metadataCoverage:Object.fromEntries(['period','purpose','size'].map(field=>[field,icons.filter(i=>i[field]).length])),
  withoutDescription:icons.filter(i=>!i.description).map(i=>({slug:i.slug,title:i.title,sourceUrl:i.sourceUrl})),
  records:snapshot.cards.map(c=>({sourceId:c.id,sourcePath:c.sourcePath,publishedAtSource:c.published,canonical:aliases[c.sourcePath]??null,decision:duplicateIds.has(c.id)?'duplicate':c.published?'migrated':'unpublished'}))};
// All checks happen before content writes; reruns reuse original bytes and preserve slugs.
await mkdir(new URL('reports/',root),{recursive:true});
for(const [from,to] of assetsToCopy)await copyFile(from,to);
await write('public/content/icons.json',icons.sort((a,b)=>a.order-b.order));
await write('public/assets/icons/manifest.json',manifest.sort((a,b)=>a.id.localeCompare(b.id)));
await write('public/content/aliases.json',Object.fromEntries(Object.entries(aliases).sort(([a],[b])=>a<b?-1:a>b?1:0)));
await write('tests/fixtures/migration/icon-inventory.json',fixture);
await writeFile(new URL('scripts/data/legacy-icon-map.mjs',root),`export const legacyIconMap = ${JSON.stringify(mappings.sort((a,b)=>a.legacyPath.localeCompare(b.legacyPath)),null,2)};\n`,'utf8');
await write('reports/cargo-complete-migration.json',report);
const durable=await read('reports/icon-migration.json');
durable.supplementalSource={snapshot:'scripts/data/cargo-catalog-20260908.json',observedAt:snapshot.observedAt};
durable.assets=manifest;
durable.summary={...durable.summary,mappedRecords:icons.length,uniqueSlugs:icons.length,publishedRecords:icons.length,
  unpublishedRecords:0,assetFiles:manifest.length,assetBytes:manifest.reduce((n,a)=>n+a.bytes,0)};
durable.records=icons.map(i=>({legacyPath:new URL(i.sourceUrl).pathname,slug:i.slug,title:i.title,sourceUrl:i.sourceUrl,published:i.published,assetFiles:i.images.map(a=>a.src.split('/').at(-1))}));
for(const output of durable.outputs){
  const bytes=await readFile(new URL(output.path,root));
  output.bytes=bytes.length;output.sha256=digest(bytes);
  output.records=output.id==='icons'?icons.length:output.id==='aliases'?Object.keys(aliases).length:manifest.length;
}
await write('reports/icon-migration.json',durable);
// Aliases are shared with editorial content; keep its output audit accurate too.
const editorial=await read('reports/editorial-migration.json');
for(const output of editorial.outputs){
  if(output.path!=='public/content/aliases.json')continue;
  const bytes=await readFile(new URL(output.path,root));
  output.bytes=bytes.length;output.sha256=digest(bytes);
}
await write('reports/editorial-migration.json',editorial);
console.log(JSON.stringify({publishedCards:report.publishedCards,originalAssets:manifest.length,copied:assetsToCopy.length,coverage:report.metadataCoverage},null,2));
