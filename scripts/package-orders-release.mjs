import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { prepareHomeShopRelease } from './package-home-shop-release.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function prepareOrderRelease({baselineRoot, buildRoot, outputRoot}) {
  const icons=JSON.parse(await readFile(path.join(baselineRoot,'content/icons.json'),'utf8'));
  const result=await prepareHomeShopRelease({baselineRoot,buildRoot,outputRoot,
    approvedRoutes:['/','/collection',...icons.filter(icon=>icon.published!==false).map(icon=>'/icons/'+icon.slug)]});
  const before=await readFile(path.join(outputRoot,'before.sha256'),'utf8');
  const lines=(await readFile(path.join(outputRoot,'after.sha256'),'utf8')).trim().split('\n');
  const after=new Map(lines.map(line=>[line.slice(66),line.slice(0,64)]));
  const extra=[
    'privacy/index.html','order-request.php','corona/admin/orders.php',
    'corona/admin/orders/store.php','corona/admin/orders/admin.php','corona/admin/text-editor/editor.php'
  ];
  for(const file of extra) {
    const bytes=await readFile(path.join(buildRoot,file));
    const dest=path.join(outputRoot,'site',file);
    await mkdir(path.dirname(dest),{recursive:true}); await writeFile(dest,bytes);
    after.set(file,hash(bytes));
  }
  assert.ok(before.includes('  privacy/index.html\n'),'Missing live privacy page guard');
  const editor=await readFile(path.join(baselineRoot,'corona/admin/text-editor/editor.php'));
  await writeFile(path.join(outputRoot,'before.sha256'),before+hash(editor)+'  corona/admin/text-editor/editor.php\n');
  await writeFile(path.join(outputRoot,'after.sha256'),[...after].map(([file,sum])=>sum+'  '+file).sort().join('\n')+'\n');
  return {...result,files:after.size};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [baselineRoot,buildRoot,outputRoot]=process.argv.slice(2);
  assert.ok(baselineRoot && buildRoot && outputRoot,'LIVE BUILD OUTPUT required');
  console.log(await prepareOrderRelease({baselineRoot,buildRoot,outputRoot}));
}
