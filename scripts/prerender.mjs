#!/usr/bin/env node
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { validateContentBundle } from '../src/content/schema.js';
import { siteConfig } from '../src/data/site-config.js';
import { buildSeoDescriptor, listCanonicalPaths } from '../src/lib/seo.js';
import {
  buildApacheConfig,
  buildRobots,
  buildSitemap,
  outputPathForRoute,
  renderDocument,
} from './lib/static-site.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function containedFile(root, relativePath) {
  if (typeof relativePath !== 'string' || path.isAbsolute(relativePath)) {
    throw new Error(`Invalid content manifest path: ${relativePath}`);
  }
  const resolvedRoot = path.resolve(root);
  const resolvedFile = path.resolve(root, relativePath);
  const relative = path.relative(resolvedRoot, resolvedFile);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Content manifest path escapes content root: ${relativePath}`);
  }
  return resolvedFile;
}

async function readBundle(contentRoot) {
  const manifest = JSON.parse(await readFile(path.join(contentRoot, 'manifest.json'), 'utf8'));
  if (!manifest?.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) {
    throw new Error('Content manifest files must be an object');
  }
  const entries = [];
  for (const [key, filename] of Object.entries(manifest.files)) {
    entries.push([key, JSON.parse(await readFile(containedFile(contentRoot, filename), 'utf8'))]);
  }
  const bundle = { version: manifest.version, ...Object.fromEntries(entries) };
  const validation = validateContentBundle(bundle);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  return bundle;
}

export async function generateStaticSite({
  root = projectRoot,
  clientRoot = path.join(root, 'dist', 'client'),
  prerenderRoot = path.join(root, 'dist', 'prerender'),
  contentRoot = path.join(root, 'public', 'content'),
} = {}) {
  const template = await readFile(path.join(clientRoot, 'index.html'), 'utf8');
  const apacheTemplate = await readFile(path.join(clientRoot, '.htaccess'), 'utf8');
  const bundle = await readBundle(contentRoot);
  const serverEntry = path.join(prerenderRoot, 'entry-server.js');
  const { renderApp } = await import(pathToFileURL(serverEntry).href);
  const canonicalPaths = listCanonicalPaths(bundle);

  for (const pathname of canonicalPaths) {
    const outputPath = outputPathForRoute(clientRoot, pathname);
    const rendered = renderApp(pathname, bundle);
    const document = renderDocument(template, {
      pathname,
      appHtml: rendered.html,
      seo: buildSeoDescriptor(pathname, bundle),
      metrikaId: siteConfig.metrikaId,
    });
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, document);
  }

  const notFoundPath = '/404';
  const notFound = renderApp(notFoundPath, bundle);
  await writeFile(path.join(clientRoot, '404.html'), renderDocument(template, {
    pathname: notFoundPath,
    appHtml: notFound.html,
    seo: buildSeoDescriptor(notFoundPath, bundle),
    metrikaId: siteConfig.metrikaId,
  }));
  await writeFile(path.join(clientRoot, 'sitemap.xml'), buildSitemap(canonicalPaths, siteConfig.url));
  await writeFile(path.join(clientRoot, 'robots.txt'), buildRobots(`${siteConfig.url}/sitemap.xml`));
  await writeFile(path.join(clientRoot, '.htaccess'), buildApacheConfig(apacheTemplate, {
    canonicalPaths,
    aliases: bundle.aliases,
    siteUrl: siteConfig.url,
  }));

  await rm(prerenderRoot, { recursive: true, force: true });
  return { routeCount: canonicalPaths.length };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await generateStaticSite();
  console.log(`Generated ${result.routeCount} canonical static pages.`);
}
