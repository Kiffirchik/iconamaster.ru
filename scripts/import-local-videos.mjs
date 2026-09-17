// Usage: node scripts/import-local-videos.mjs <folder containing original MP4s>
// Requires ffmpeg and ffprobe on PATH. Originals are read only; no lossy re-encoding.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const sourceFolder = process.argv[2];
if (!sourceFolder) throw new Error('Pass the original video folder as the first argument.');
const specs = JSON.parse(await readFile(new URL('./data/local-videos.json', import.meta.url)));
const out = path.join(root, 'public/assets/videos');
await mkdir(out, { recursive: true });
const probe = file => JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { windowsHide: true, encoding: 'utf8' }));
async function hash(file) {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  return digest.digest('hex');
}
const records = [], assets = [], sources = [];
for (const spec of specs) {
  const input = path.join(sourceFolder, spec.filename);
  const originalHash = await hash(input);
  const info = probe(input);
  const stream = info.streams.find(item => item.codec_type === 'video');
  if (stream.codec_name !== 'h264' || info.streams.find(item => item.codec_type === 'audio')?.codec_name !== 'aac') {
    throw new Error('Expected H.264 + AAC: ' + spec.filename);
  }
  const rotation = stream.side_data_list?.find(item => Number.isFinite(item.rotation))?.rotation || 0;
  const rotated = Math.abs(rotation) % 180 === 90;
  const width = rotated ? stream.height : stream.width;
  const height = rotated ? stream.width : stream.height;
  const src = '/assets/videos/' + spec.id + '.mp4';
  const poster = '/assets/videos/' + spec.id + '.jpg';
  const output = path.join(out, spec.id + '.mp4');
  const posterOutput = path.join(out, spec.id + '.jpg');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', input, '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', '-movflags', '+faststart', output], { windowsHide: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(spec.posterSeconds), '-i', input, '-frames:v', '1', '-q:v', '3', posterOutput], { windowsHide: true });
  if (await hash(input) !== originalHash) throw new Error('Original changed: ' + spec.filename);
  const outputInfo = probe(output);
  const imageInfo = probe(posterOutput).streams[0];
  records.push({
    provider: 'local', id: spec.id, title: spec.title, description: spec.description,
    autoplay: false, published: true, sourceUrl: 'owner-video:' + spec.id + '.mp4',
    src, duration: Number(outputInfo.format.duration), width, height,
    image: { src: poster, width: imageInfo.width, height: imageInfo.height, alt: 'Кадр из видео «' + spec.title + '»' },
  });
  sources.push({ id: spec.id, filename: spec.filename, sha256: originalHash, bytes: Number(info.format.size), rotation, posterSeconds: spec.posterSeconds });
  for (const [assetSrc, file] of [[src, output], [poster, posterOutput]]) {
    assets.push({ src: assetSrc, sha256: await hash(file), bytes: (await readFile(file)).length, ownerId: spec.id });
  }
  console.log(spec.id + ': ' + width + 'x' + height);
}
const contentFile = path.join(root, 'public/content/videos.json');
const existing = JSON.parse(await readFile(contentFile, 'utf8'));
const ids = new Set(records.map(item => item.id));
await writeFile(contentFile, JSON.stringify([...records, ...existing.filter(item => item.provider !== 'local' || !ids.has(item.id))], null, 2) + '\n');
await writeFile(path.join(root, 'reports/video-import.json'), JSON.stringify({ schemaVersion: 1, method: 'Lossless stream copy, faststart; original-frame JPEG posters with metadata rotation applied', sources, assets }, null, 2) + '\n');
// Refresh the existing content-output audit without changing its historical Cargo asset evidence.
const auditPath = path.join(root, 'reports/editorial-migration.json');
const audit = JSON.parse(await readFile(auditPath, 'utf8'));
audit.summary.records.videos = JSON.parse(await readFile(contentFile, 'utf8')).length;
for (const output of audit.outputs) {
  if (output.path !== 'public/content/videos.json') continue;
  output.bytes = (await readFile(contentFile)).length;
  output.records = audit.summary.records.videos;
  output.sha256 = await hash(contentFile);
}
await writeFile(auditPath, JSON.stringify(audit, null, 2) + '\n');
