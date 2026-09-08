import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeCargoCard, findSharedImages } from '../../scripts/lib/cargo-catalog.mjs';

test('Cargo extraction keeps description, separates price and uses only page-owned originals', () => {
  const card = summarizeCargoCard({id:1,project_url:'TEST',title_no_html:'Икона',display:true,
    content:'<div grid-row=""><div grid-col=""><img data-src="https://freight.cargo.site/t/original/i/abc/1.jpg"></div><div grid-col=""><b>Икона.</b><br>25 000 руб.<br>31х27 см., доска. Авторская работа.</div></div>',
    images:[{id:2,hash:'abc',name:'1.jpg',width:400,height:500}]});
  assert.equal(card.price, '25 000 руб.');
  assert.equal(card.description, '31х27 см., доска. Авторская работа.');
  assert.equal(card.originals[0].sourceUrl,'https://freight.cargo.site/t/original/i/abc/1.jpg');
  assert.equal(card.published,true);
});

test('same title alone is not a duplicate, shared image is flagged including unpublished records', () => {
  const cards = [
    {id:1,title:'Икона',published:true,originals:[{hash:'one'}]},
    {id:2,title:'Икона',published:true,originals:[{hash:'two'}]},
    {id:3,title:'Икона copy',published:false,originals:[{hash:'one'}]},
  ];
  assert.deepEqual(findSharedImages(cards),[{hash:'one',cardIds:[1,3]}]);
});

test('blank source copy stays blank rather than manufacturing product facts', () => {
  const card=summarizeCargoCard({id:1,project_url:'EMPTY',title_no_html:'Икона',display:false,content:'<img>',images:[]});
  assert.equal(card.description,'');
  assert.equal(card.price,null);
  assert.equal(card.published,false);
});
