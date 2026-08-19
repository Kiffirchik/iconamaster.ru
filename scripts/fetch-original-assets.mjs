import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const sources = [
  { id: 'archangel-michael-main', file: 'archangel-michael.jpg', width: 411, height: 500, sourceUrl: 'https://freight.cargo.site/t/original/i/8fad7b16eab7085982aef13e931609d36143181ad5c73e11542b81e82cf01839/21.jpg' },
  { id: 'resurrection-main', file: 'resurrection.jpg', width: 1900, height: 2946, sourceUrl: 'https://freight.cargo.site/t/original/i/a754da07638f063493a3cb773a2d935409f1774113fb52458c383397f5f65c0e/1_4.jpg' },
  { id: 'alexander-peresvet-main', file: 'alexander-peresvet.jpg', width: 242, height: 500, sourceUrl: 'https://freight.cargo.site/t/original/i/ba7969ee77da3752e8916c8c7419f916d2dfd46f93151bec930e27aac35176bc/6.jpg' },
  { id: 'facade-george-main', file: 'facade-george.jpg', width: 629, height: 817, sourceUrl: 'https://freight.cargo.site/t/original/i/6c1fb1ffaf90b3c18e7a4ca7b76383fd93de8692382bb8de5d04b95348645da5/10.jpg' },
  { id: 'facade-george-2', file: 'facade-george-2.jpg', width: 678, height: 1057, sourceUrl: 'https://freight.cargo.site/t/original/i/e0734f6f0df730dde3bbee7bcfd09ee4255d51c88c8ed5e3c11e5251b92acac8/10_4.jpg' },
  { id: 'facade-george-3', file: 'facade-george-3.jpg', width: 1900, height: 2850, sourceUrl: 'https://freight.cargo.site/t/original/i/66d659c4022a086cf1c9d3d7488daccf67b5e9a3fbd29afe2a207164c901e901/10_1.jpg' },
  { id: 'facade-george-4', file: 'facade-george-4.jpg', width: 592, height: 888, sourceUrl: 'https://freight.cargo.site/t/original/i/a99e51e533d455a3269c586a64527cbe08d8abf7d78cf4e976c52917a5dabacc/10_2.jpg' },
  { id: 'facade-george-5', file: 'facade-george-5.jpg', width: 1900, height: 3341, sourceUrl: 'https://freight.cargo.site/t/original/i/fb76c1f370d37c09929b79ef91c76337ef52e957b8c9127e8dba28d9f20badb2/10_3.jpg' },
  { id: 'sretenie-main', file: 'sretenie.jpg', width: 495, height: 665, sourceUrl: 'https://freight.cargo.site/t/original/i/f4dd4828ddffb5fceaa9ac85aebf164474186767ebeccf7f96d869870e14853b/13.jpg' },
  { id: 'sergius-appearance-main', file: 'sergius-appearance.jpg', width: 715, height: 955, sourceUrl: 'https://freight.cargo.site/t/original/i/75a284fdf7cdc5e591a0d2c0ef47dfcc52cdf813960431718c9c3944cddb11e8/------18-19---..jpeg' },
  { id: 'sergius-appearance-2', file: 'sergius-appearance-2.jpg', width: 2442, height: 2935, sourceUrl: 'https://freight.cargo.site/t/original/i/36599c28cce1dc20e057ae69c95514a17c43108c2b6ce615fcda0b4c70905ec2/---.JPG' }
];

const outputDirectory = new URL('../public/assets/icons/', import.meta.url);

await mkdir(outputDirectory, { recursive: true });

const manifest = [];
for (const source of sources) {
  const response = await fetch(source.sourceUrl);
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!response.ok || !contentType.startsWith('image/')) {
    throw new Error(`Could not download original asset: ${source.file}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(source.file, outputDirectory), bytes);
  manifest.push({
    ...source,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')
  });
}

manifest.sort((left, right) => left.id.localeCompare(right.id));
await writeFile(new URL('manifest.json', outputDirectory), `${JSON.stringify(manifest, null, 2)}\n`);
