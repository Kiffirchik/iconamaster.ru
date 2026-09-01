#!/usr/bin/env node
import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function copyTree(sourceRoot, targetRoot) {
  let copied = 0;
  for (const entry of await readdir(sourceRoot, { withFileTypes: true })) {
    const source = path.join(sourceRoot, entry.name);
    const target = path.join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      copied += await copyTree(source, target);
      continue;
    }
    if (!entry.isFile()) continue;
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
    copied += 1;
  }
  return copied;
}

export async function prepareMtwBuild({
  publicRoot = path.join(projectRoot, "public"),
  optimizedRoot = path.join(projectRoot, "release", "optimized-assets"),
  distRoot = path.join(projectRoot, "dist", "client"),
} = {}) {
  const indexPath = path.join(distRoot, "index.html");
  if (!(await stat(indexPath)).isFile()) throw new Error(`Missing MTW build input: ${indexPath}`);

  const replacedAssets = await copyTree(optimizedRoot, distRoot);
  await copyFile(path.join(publicRoot, ".htaccess"), path.join(distRoot, ".htaccess"));
  return { replacedAssets };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await prepareMtwBuild();
  console.log(`Prepared MTW build with ${result.replacedAssets} approved deployment derivatives.`);
}
