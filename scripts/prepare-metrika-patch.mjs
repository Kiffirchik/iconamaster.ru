import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const html = await readFile('dist/client/index.html', 'utf8');
const script = html.match(/<script data-metrika="112185835">[\s\S]*?<\/script>/u)?.[0];
const asset = html.match(/src="\/assets\/(index-[\w-]+\.js)"/u)?.[1];
if (!script?.includes("'iconamaster:pageview'") || !asset) throw new Error('Missing built tracking integration');
const out = 'dist/metrika-patch';
await mkdir(out, { recursive: true });
await writeFile(`${out}/metrika-script.html`, script);
await copyFile(`dist/client/assets/${asset}`, `${out}/${asset}`);
for (const file of ['patch-metrika-pageviews.php', 'deploy-metrika-pageviews.sh']) {
  // Shell uploads must retain Unix newlines on Windows checkouts.
  await writeFile(`${out}/${file}`, (await readFile(`scripts/${file}`, 'utf8')).replace(/\r\n/gu, '\n'));
}
for (const file of [asset, 'metrika-script.html', 'patch-metrika-pageviews.php', 'deploy-metrika-pageviews.sh']) {
  console.log(`${createHash('sha256').update(await readFile(`${out}/${file}`)).digest('hex')}  ${file}`);
}
