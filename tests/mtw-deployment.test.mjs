import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareMtwBuild } from "../scripts/prepare-mtw-build.mjs";

test("Apache serves real files and falls back app routes to index.html", async () => {
  const source = await readFile(new URL("../public/.htaccess", import.meta.url), "utf8");

  assert.match(source, /^RewriteEngine On$/m);
  assert.match(source, /^RewriteCond %\{REQUEST_FILENAME\} -f \[OR\]$/m);
  assert.match(source, /^RewriteCond %\{REQUEST_FILENAME\} -d$/m);
  assert.match(source, /^RewriteRule \^ - \[L\]$/m);
  assert.match(source, /^RewriteRule \^ index\.html \[L\]$/m);
});

test("MTW packaging deploys approved derivatives without changing original media", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "iconamaster-mtw-build-"));
  const publicRoot = path.join(root, "public");
  const optimizedRoot = path.join(root, "release-assets");
  const distRoot = path.join(root, "dist", "client");
  const relativeAsset = path.join("assets", "icons", "sample.jpg");
  const original = Buffer.from("immutable-original-icon");
  const derivative = Buffer.from("approved-deployment-derivative");

  try {
    await mkdir(path.join(publicRoot, "assets", "icons"), { recursive: true });
    await mkdir(path.join(optimizedRoot, "assets", "icons"), { recursive: true });
    await mkdir(path.join(distRoot, "assets", "icons"), { recursive: true });
    await writeFile(path.join(publicRoot, relativeAsset), original);
    await writeFile(path.join(publicRoot, ".htaccess"), "RewriteEngine On\n");
    await writeFile(path.join(optimizedRoot, relativeAsset), derivative);
    await writeFile(path.join(distRoot, "index.html"), "<!doctype html>");
    await writeFile(path.join(distRoot, relativeAsset), original);

    const result = await prepareMtwBuild({ publicRoot, optimizedRoot, distRoot });

    assert.equal(result.replacedAssets, 1);
    assert.deepEqual(await readFile(path.join(publicRoot, relativeAsset)), original);
    assert.deepEqual(await readFile(path.join(distRoot, relativeAsset)), derivative);
    assert.equal(await readFile(path.join(distRoot, ".htaccess"), "utf8"), "RewriteEngine On\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
