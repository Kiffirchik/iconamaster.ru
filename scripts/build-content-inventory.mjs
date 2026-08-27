import { readdir, readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  extractEmbeddedPage,
  extractLinkedCards,
  extractLinks,
  extractMediaEntries,
  extractTitle,
  getMediaDisposition,
  normalizeMediaEntries,
  partitionContractedLinks,
} from './lib/legacy-html.mjs';

const sourceSite = 'https://iconamaster.cargo.site';

const expectedMissingIconPaths = [
  '/IKONA-CUDO-AKISTRATIGA-MIKAILA',
  '/IKONA-PREPODOBNYE-ZOSIMA-I-SAVVATII-SOLOVETKIE',
  '/IKONA-SPAS-VSEDERZITEL-V-DRAGOTENNOM-OKLADE-S-FARFOROVYMI-VSTAVKAMI-I',
  '/IKONA-SVYTOI-KNYZ-VLADISLAV-CESSKII',
];

const expectedDamagedIconPaths = [
  '/IKONA-BOGORODITY-PETROVSKAY-V-REZNOM-KIOTE',
  '/IKONA-BOGORODITY-RUSSKAY',
  '/IKONA-BOGORODITY-TREK-RADOSTEI',
];

const approvedArticlePaths = [
  '/GUSLITA-ODIN-IZ-KRUPNEISIK-STAROOBRYDCESKIK-TENTROV-KNIGOPISANIY-I',
  '/IKONA-BOGORODITY-RUSSKAY-ILI-VZBRANNAY-VOEVODA-1',
  '/IKONOPISNYI-KANON-KAK-MESTO-DUKOVNOI-BRANI',
  '/IKONY-RUSSKOGO-PANTELEIMONOVA-MONASTYRY',
  '/ISTORIY-RAZVITIY-I-STILI-OKLADOV-IKON',
  '/KINESMA-STARYI-IKONOPISNYI-TENTR-STAROOBRYDCESTVA',
  '/PAVLOVO-NA-OKE-STAROOBRYDCESKII-IKONOPISNYI-TENTR',
  '/PIS-MA-GORBUNOVYK-IKONY-SELA-KOLUI',
];

const excludedArticlePaths = [
  '/IKONY-V-OKLADAK-TRADITIY-I-ISTORIY',
];

const servicePaths = [
  '/EKSKURSIY-PO-MASTERSKOI',
  '/IKONOSTASY',
  '/KIOTY-I-REZ-BA',
  '/MERNAY-IKONA',
  '/MOSKOVSKAY-IKONOPISNAY-MASTERSKAY',
  '/OKLADY',
  '/RESTAVRATIY',
];

const navigationPaths = new Set([
  '/',
  '/IKONY',
  '/IKONY-V-NALICIE',
  '/KONTAKTY',
  '/STAT-I',
  '/VIDEO',
  ...servicePaths,
]);

const sortedUnique = (values) => [...new Set(values)].sort();

const localPathFor = (sourcePath) => `${sourcePath.slice(1)}/index.html`;

const sourceUrlFor = (sourcePath) => new URL(sourcePath, sourceSite).href;

const stripBrand = (title) => title
  .replace(/\s+(?:-|—)\s+iconamaster$/iu, '')
  .trim();

const cleanTitle = (html) => stripBrand(extractTitle(html));

const assertExactList = (label, actual, expected) => {
  const sortedActual = sortedUnique(actual);
  const sortedExpected = sortedUnique(expected);
  if (JSON.stringify(sortedActual) !== JSON.stringify(sortedExpected)) {
    throw new Error(
      `${label} mismatch\nExpected: ${JSON.stringify(sortedExpected)}\nActual: ${JSON.stringify(sortedActual)}`,
    );
  }
};

const readPage = async (sourceDirectory, sourcePath) => {
  const localPath = localPathFor(sourcePath);
  try {
    return {
      html: await readFile(path.join(sourceDirectory, localPath), 'utf8'),
      localPath,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { html: null, localPath: null };
    }
    throw error;
  }
};

const makeRecord = async (sourceDirectory, sourcePath, fallback = {}) => {
  const page = await readPage(sourceDirectory, sourcePath);
  const issues = [];
  let embedded = null;
  if (page.html) {
    try {
      embedded = extractEmbeddedPage(page.html, sourcePath);
    } catch (error) {
      issues.push(error.message === 'Unterminated ScaffoldingData script'
        ? 'Embedded Cargo data is unterminated'
        : 'Embedded Cargo data is malformed');
    }
  } else {
    issues.push('Local page is absent from the archive');
  }

  const pageMedia = page.html
    ? normalizeMediaEntries([
      ...extractMediaEntries(page.html, 'local-page-html'),
      ...(embedded?.media ?? []),
    ])
    : [];
  if (page.html && pageMedia.length === 0) {
    issues.push('No media URL found in the local page');
  }

  return {
    sourcePath,
    sourceUrl: sourceUrlFor(sourcePath),
    localPath: page.localPath,
    title: page.html
      ? stripBrand(embedded?.title || fallback.title || cleanTitle(page.html) || '')
      : fallback.title || '',
    media: normalizeMediaEntries([...pageMedia, ...(fallback.media ?? [])]),
    ...(issues.length > 0 ? { issues: sortedUnique(issues) } : {}),
  };
};

const countFiles = async (directory) => {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      count += await countFiles(path.join(directory, entry.name));
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
};

const uniqueMediaUrls = (records, role) => sortedUnique(records.flatMap(({ media }) => media
  .filter((entry) => !role || entry.role === role)
  .map(({ url }) => url)));

const main = async () => {
  const sourceFlag = process.argv.indexOf('--source');
  const sourceArgument = sourceFlag >= 0 ? process.argv[sourceFlag + 1] : undefined;
  if (!sourceArgument) {
    throw new Error('Usage: node scripts/build-content-inventory.mjs --source <archive-directory>');
  }

  const sourceDirectory = path.resolve(sourceArgument);
  if (!(await stat(sourceDirectory)).isDirectory()) {
    throw new Error(`Source is not a directory: ${sourceDirectory}`);
  }

  const catalogHtml = await readFile(
    path.join(sourceDirectory, localPathFor('/IKONY-V-NALICIE')),
    'utf8',
  );
  const catalogCards = extractLinkedCards(catalogHtml);
  if (catalogCards.length !== 50) {
    throw new Error(`Expected 50 catalog links, found ${catalogCards.length}`);
  }

  const icons = await Promise.all(catalogCards.map(async (card) => {
    const record = await makeRecord(sourceDirectory, card.sourcePath, card);
    return {
      ...record,
      ...getMediaDisposition(record.media),
    };
  }));
  icons.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));

  const presentIcons = icons.filter(({ localPath }) => localPath !== null);
  const missingIconPages = icons
    .filter(({ localPath }) => localPath === null)
    .map(({ sourcePath }) => sourcePath);
  if (presentIcons.length !== 46) {
    throw new Error(`Expected 46 locally present icon pages, found ${presentIcons.length}`);
  }
  assertExactList('Missing icon pages', missingIconPages, expectedMissingIconPaths);
  const recoveryRequiredIconPaths = icons
    .filter(({ mediaRecovery }) => mediaRecovery === 'required-public-or-cargo')
    .map(({ sourcePath }) => sourcePath);
  assertExactList(
    'Icons requiring public/Cargo recovery',
    recoveryRequiredIconPaths,
    [...expectedMissingIconPaths, ...expectedDamagedIconPaths],
  );

  const articleIndexHtml = await readFile(
    path.join(sourceDirectory, localPathFor('/STAT-I')),
    'utf8',
  );
  const articleCandidates = extractLinks(articleIndexHtml).filter(
    (sourcePath) => /^\/[^/]+$/u.test(sourcePath) && !navigationPaths.has(sourcePath),
  );
  const articleContract = partitionContractedLinks(articleCandidates, {
    included: approvedArticlePaths,
    excluded: excludedArticlePaths,
  });

  const articles = await Promise.all(articleContract.included.map(
    (sourcePath) => makeRecord(sourceDirectory, sourcePath),
  ));
  const missingArticles = articles.filter(({ localPath }) => localPath === null);
  if (articles.length !== 8 || missingArticles.length > 0) {
    throw new Error(
      `Expected eight locally present approved articles; missing: ${missingArticles.map(({ sourcePath }) => sourcePath).join(', ')}`,
    );
  }

  const excludedArticleCandidates = await Promise.all(
    articleContract.excluded.map((sourcePath) => makeRecord(sourceDirectory, sourcePath)),
  );

  const services = await Promise.all(servicePaths.map(
    (sourcePath) => makeRecord(sourceDirectory, sourcePath),
  ));
  const missingServices = services.filter(({ localPath }) => localPath === null);
  if (services.length !== 7 || missingServices.length > 0) {
    throw new Error(
      `Expected seven locally present service pages; missing: ${missingServices.map(({ sourcePath }) => sourcePath).join(', ')}`,
    );
  }

  const allIconMediaUrls = uniqueMediaUrls(icons);
  const iconOriginalMediaUrls = uniqueMediaUrls(icons, 'original');
  const inventory = {
    schemaVersion: 2,
    source: {
      siteUrl: sourceSite,
      archiveName: path.basename(sourceDirectory),
      fileCount: await countFiles(sourceDirectory),
    },
    summary: {
      catalogLinks: catalogCards.length,
      localIconPages: presentIcons.length,
      missingIconPages: missingIconPages.length,
      iconMediaUrls: allIconMediaUrls.length,
      iconOriginalMediaUrls: iconOriginalMediaUrls.length,
      iconPageMediaUrls: uniqueMediaUrls(icons, 'page-media').length,
      iconThumbnailMediaUrls: uniqueMediaUrls(icons, 'thumbnail').length,
      iconRecoveryRequired: recoveryRequiredIconPaths.length,
      unpublishedIcons: icons.filter(({ publicationStatus }) => publicationStatus === 'unpublished').length,
      articleLinks: articles.length,
      articleMediaUrls: uniqueMediaUrls(articles).length,
      excludedArticleLinks: excludedArticleCandidates.length,
      servicePages: services.length,
      serviceMediaUrls: uniqueMediaUrls(services).length,
    },
    icons,
    missingIconPages,
    articles,
    excludedArticleCandidates,
    services,
  };

  const outputUrl = new URL('../tmp/migration-inventory.json', import.meta.url);
  await mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
  await writeFile(outputUrl, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(inventory.summary, null, 2));
  console.log(`Inventory written to ${outputUrl.pathname}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
