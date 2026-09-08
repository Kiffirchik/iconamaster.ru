import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {summarizeCargoCard, findSharedImages} from './lib/cargo-catalog.mjs';

// Input is the JSON response to the public site's own pages?pid_list= API.
// No credentials, cookies, editor state or account data are captured.
const root = new URL('../', import.meta.url);
const raw = await readFile(new URL(process.argv[2] ?? 'tmp/cargo-all-pages.json',root));
const expected = JSON.parse(await readFile(new URL('scripts/data/cargo-card-ids.json',root),'utf8'));
const pages = JSON.parse(raw);
const ids = pages.map(p=>p.id);
if (ids.length !== expected.cardIds.length || new Set(ids).size !== ids.length
  || expected.cardIds.some(id=>!ids.includes(id))) throw new Error('Cargo inventory incomplete or contains duplicate ids');
const cards = expected.cardIds.map(id=>summarizeCargoCard(pages.find(p=>p.id===id)));
const hidden=cards.filter(c=>!c.published).map(c=>c.id);
if(JSON.stringify(hidden)!==JSON.stringify(expected.unpublishedCardIds)) throw new Error('Source publication status changed; review before importing');
const snapshot={schemaVersion:1,observedAt:expected.observedAt,source:expected.source,rawResponseSha256:createHash('sha256').update(raw).digest('hex'),cards,sharedImages:findSharedImages(cards),excludedServiceRecords:expected.excludedServiceRecords};
await writeFile(new URL('scripts/data/cargo-catalog-20260908.json',root),JSON.stringify(snapshot,null,2)+'\n','utf8');
console.log(JSON.stringify({cards:cards.length,published:cards.filter(c=>c.published).length,originals:cards.reduce((n,c)=>n+c.originals.length,0),sharedImages:snapshot.sharedImages},null,2));
