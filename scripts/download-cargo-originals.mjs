import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {imageDimensions} from './migrate-icons.mjs';

const root=new URL('../',import.meta.url);
const snapshot=JSON.parse(await readFile(new URL('scripts/data/cargo-catalog-20260908.json',root),'utf8'));
const manifest=JSON.parse(await readFile(new URL('public/assets/icons/manifest.json',root),'utf8'));
const known=new Set(manifest.map(a=>a.sourceUrl));
const jobs=snapshot.cards.filter(c=>c.published).flatMap(c=>c.originals.filter(a=>!known.has(a.sourceUrl)).map(a=>({...a,cardId:c.id,legacyPath:c.sourcePath})));
await mkdir(new URL('tmp/cargo-originals/',root),{recursive:true});
const download=url=>new Promise((resolve,reject)=>{
  const proc=spawn('curl.exe',['--fail','--location','--silent','--show-error','--max-time','40','--retry','2',url],{windowsHide:true});
  const chunks=[];let error='';
  proc.stdout.on('data',c=>chunks.push(c));proc.stderr.on('data',c=>error+=c);proc.on('error',reject);
  proc.on('close',code=>code===0?resolve(Buffer.concat(chunks)):reject(new Error(error||`curl ${code}`)));
});
const results=[];const failures=[];let index=0;
await Promise.all(Array.from({length:4},async()=>{
  while(index<jobs.length){
    const a=jobs[index++];
    try{
      const url=new URL(a.sourceUrl);
      if(url.origin!=='https://freight.cargo.site'||!/^[a-f0-9]+$/u.test(a.hash))throw new Error('Unapproved image source');
      const file=`${a.hash}.jpg`;
      const cache=new URL(`tmp/cargo-originals/${file}`,root);
      let bytes=await readFile(cache).catch(()=>null);
      if(!bytes){bytes=await download(a.sourceUrl);imageDimensions(bytes);await writeFile(cache,bytes);}
      const dims=imageDimensions(bytes);
      if(dims.width!==a.width||dims.height!==a.height)throw new Error(`Source dimensions differ: ${JSON.stringify(dims)} vs ${a.width}x${a.height}`);
      results.push({...a,file,...dims,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
      console.log(`OK ${a.cardId}/${a.id} ${bytes.length} bytes`);
    }catch(error){failures.push({...a,error:error.message});console.error(`FAILED ${a.cardId}/${a.id} ${error.message}`);}
  }
}));
results.sort((a,b)=>a.id-b.id);
await writeFile(new URL('tmp/cargo-asset-cache.json',root),JSON.stringify({results,failures},null,2)+'\n');
console.log(JSON.stringify({downloaded:results.length,failures:failures.length,bytes:results.reduce((n,a)=>n+a.bytes,0)}));
if(failures.length)process.exitCode=1;
