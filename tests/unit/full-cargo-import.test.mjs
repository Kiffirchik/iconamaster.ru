import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const load=async name=>JSON.parse(await readFile(new URL(`../../${name}`,import.meta.url),'utf8'));
test('every Cargo public card has a canonical item or reviewed duplicate mapping, never just first 50',async()=>{
  const source=await load('scripts/data/cargo-catalog-20260908.json');
  const icons=await load('public/content/icons.json');
  const aliases=await load('public/content/aliases.json');
  assert.equal(source.cards.length,97);
  for(const card of source.cards.filter(c=>c.published)){
    assert.ok(aliases[card.sourcePath],`Missing original card ${card.id}`);
    assert.ok(icons.some(i=>`/icons/${i.slug}`===aliases[card.sourcePath]),card.sourcePath);
  }
  assert.equal(icons.some(i=>i.sourceUrl.endsWith('/IKONA-BOGORODITY-UTOLI-MOI-PECALI-2')),false);
});
test('period and object dimensions override old prototype guesses without moving attribution into a separate field',async()=>{
  const icons=await load('public/content/icons.json');
  const resurrection=icons.find(i=>i.slug==='resurrection');
  assert.equal(resurrection.period,'XVIII век');
  assert.equal(resurrection.purpose,'Храмовая');
  assert.match(resurrection.size,/150 × 80 см/u);
  assert.equal(icons.find(i=>i.slug==='sretenie').period,'Начало XVII века');
  assert.equal(icons.find(i=>i.slug==='archangel-michael').period,'');
  for(const icon of icons){assert.equal(icon.origin,'');assert.equal(typeof icon.purpose,'string');}
});

test('owner-confirmed price and kiot corrections replace source errors consistently',async()=>{
  const icons=await load('public/content/icons.json');
  const smolenskaya=icons.find(i=>i.slug==='ikona-bogorodity-smolenskay');
  assert.equal(smolenskaya.price,'20 000 руб.');
  assert.doesNotMatch(smolenskaya.description,/20\s+000\s+тыс/iu);
  const source=await load('scripts/data/cargo-catalog-20260908.json');
  const george=source.cards.find(c=>c.id===9160368);
  const georgeIcon=icons.find(i=>i.sourceUrl===george.sourceUrl);
  assert.equal(georgeIcon.size,'50 × 40 см; киот 64 × 54 см');
  assert.equal(georgeIcon.price,'200 000 руб.');
  assert.match(georgeIcon.description,/киоте - книжка 64 х 54 см\./u);
  assert.doesNotMatch(georgeIcon.description,/45 х 40/u);
});

test('every nonempty reviewed attribute cites the original text verbatim',async()=>{
  const source=await load('scripts/data/cargo-catalog-20260908.json');
  const metadata=await load('scripts/data/cargo-reviewed-metadata.json');
  const normalize=value=>value.replace(/\s+/gu,' ').trim();
  for(const card of source.cards){
    for(const field of ['period','purpose','size']){
      const record=metadata[card.id];
      if(!record[field])continue;
      assert.ok(normalize(`${card.title} ${card.originalText}`).includes(normalize(record.evidence[field])),`${card.id}: ${field}`);
    }
  }
});
