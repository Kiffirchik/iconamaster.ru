import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { prepareMtwBuild } from "../scripts/prepare-mtw-build.mjs";

test("Apache template reserves generated routes and returns a real 404", async () => {
  const source = await readFile(new URL("../public/.htaccess", import.meta.url), "utf8");

  assert.match(source, /^DirectoryIndex index\.html$/m);
  assert.match(source, /^ErrorDocument 404 \/404\.html$/m);
  assert.match(source, /^RewriteEngine On$/m);
  assert.match(source, /^# ICONAMASTER_ROUTE_RULES$/m);
  assert.match(source, /^# ICONAMASTER_ALIAS_RULES$/m);
  assert.match(source, /^RewriteCond %\{REQUEST_FILENAME\} -f \[OR\]$/m);
  assert.match(source, /^RewriteCond %\{REQUEST_FILENAME\} -d$/m);
  assert.match(source, /^RewriteRule \^ - \[L\]$/m);
  assert.match(source, /^RewriteRule \^ - \[R=404,L\]$/m);
  assert.doesNotMatch(source, /^RewriteRule \^ index\.html \[L\]$/m);
});

test("MTW packaging deploys derivatives without changing originals or generated routing", async () => {
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
    await writeFile(path.join(publicRoot, ".htaccess"), "public template must not be copied\n");
    await writeFile(path.join(optimizedRoot, relativeAsset), derivative);
    await writeFile(path.join(distRoot, "index.html"), "<!doctype html>");
    await writeFile(path.join(distRoot, ".htaccess"), "generated static routes\n");
    await writeFile(path.join(distRoot, relativeAsset), original);

    const result = await prepareMtwBuild({ publicRoot, optimizedRoot, distRoot });

    assert.equal(result.replacedAssets, 1);
    assert.deepEqual(await readFile(path.join(publicRoot, relativeAsset)), original);
    assert.deepEqual(await readFile(path.join(distRoot, relativeAsset)), derivative);
    assert.equal(await readFile(path.join(distRoot, ".htaccess"), "utf8"), "generated static routes\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("MTW packaging rejects a build without generated Apache routing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "iconamaster-mtw-build-"));
  const publicRoot = path.join(root, "public");
  const optimizedRoot = path.join(root, "release-assets");
  const distRoot = path.join(root, "dist", "client");

  try {
    await mkdir(publicRoot, { recursive: true });
    await mkdir(optimizedRoot, { recursive: true });
    await mkdir(distRoot, { recursive: true });
    await writeFile(path.join(distRoot, "index.html"), "<!doctype html>");

    await assert.rejects(
      prepareMtwBuild({ publicRoot, optimizedRoot, distRoot }),
      /Missing MTW build input: .*\.htaccess/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
