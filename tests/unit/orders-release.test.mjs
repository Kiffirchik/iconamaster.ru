import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Catches omissions of live templates/PHP and accidental publication of stale content.
test('order release includes live order UI and private endpoint but never overwrites live content or credentials', async t => {
  const { prepareOrderRelease } = await import('../../scripts/package-orders-release.mjs');
  const root = await mkdtemp(path.join(tmpdir(), 'orders-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (file, value) => { const p = path.join(root, file); await mkdir(path.dirname(p), {recursive:true}); await writeFile(p, typeof value === 'string' ? value : JSON.stringify(value)); };
  const old = '<script src="/assets/index-old.js"></script><link href="/assets/index-old.css">';
  const now = '<script src="/assets/index-new.js"></script><link href="/assets/index-new.css">';
  const routes = {'/':'home.html','/collection':'collection.html','/icons/test-icon':'icon.html'};
  for (const kind of ['live','build']) {
    await put(kind+'/content/icons.json', [{slug:'test-icon',published:true,images:['photo.jpg']},{slug:'hidden',published:false}]);
    await put(kind+'/content/contacts.json', {email:'iconamaster@yandex.ru'});
    await put(kind+'/.live-templates/routes.json', routes);
    for (const file of ['index.html','collection/index.html','icons/test-icon/index.html','privacy/index.html','.live-templates/home.html','.live-templates/collection.html','.live-templates/icon.html']) {
      await put(kind+'/'+file, (kind==='live'?old+'Existing ':now+'Order form ')+ '<!--VISIBLE:test-icon-->Test icon<!--/VISIBLE:test-icon-->'+(kind==='live'?'<!--VISIBLE:hidden-->Restore hidden<!--/VISIBLE:hidden-->':''));
    }
    await put(kind+'/corona/admin/text-editor/editor.php', kind==='live'?'old editor':'editor with inbox');
  }
  await put('live/articles/example/index.html', old+'OWNER ARTICLE');
  for (const file of ['order-request.php','corona/admin/orders.php','corona/admin/orders/store.php','corona/admin/orders/admin.php']) await put('build/'+file,'endpoint '+file);
  await put('build/assets/index-new.js','new JS'); await put('build/assets/index-new.css','new CSS');
  await put('build/assets/workshop/blessing-2007.jpeg','unchanged photo');
  const args={baselineRoot:path.join(root,'live'),buildRoot:path.join(root,'build'),outputRoot:path.join(root,'payload')};
  await prepareOrderRelease(args);
  const get=relative=>readFile(path.join(root,'payload/site',relative),'utf8');
  assert.match(await get('privacy/index.html'),/Order form/);
  assert.match(await get('.live-templates/icon.html'),/Order form/);
  assert.match(await get('.live-templates/collection.html'),/Restore hidden/);
  assert.equal(await get('articles/example/index.html'),now+'OWNER ARTICLE');
  assert.equal(await get('corona/admin/orders/store.php'),'endpoint corona/admin/orders/store.php');
  assert.equal(await get('corona/admin/text-editor/editor.php'),'editor with inbox');
  const after=await readFile(path.join(root,'payload/after.sha256'),'utf8');
  assert.doesNotMatch(after,/content\/|config\.php|\.editor-state|login\.php/);
  const before=await readFile(path.join(root,'payload/before.sha256'),'utf8');
  assert.match(before,/content\/contacts\.json/); assert.match(before,/corona\/admin\/text-editor\/editor\.php/);
  await put('build/content/contacts.json',{email:'different@example.test'});
  await assert.rejects(prepareOrderRelease({...args,outputRoot:path.join(root,'bad')}),/Content differs/);
});
