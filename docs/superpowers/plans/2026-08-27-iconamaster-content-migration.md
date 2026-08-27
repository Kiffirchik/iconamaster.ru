# Iconamaster Full Content Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Перенести в премиальный прототип 50 карточек икон, все доступные оригинальные изображения, восемь статей, страницы мастерской, видео и контакты на едином проверяемом JSON-контракте.

**Architecture:** Публичный интерфейс остаётся React/Vite-приложением, но перестаёт импортировать каталог из `src/data/icons.js`. Все типы контента загружаются из версионированных файлов `public/content/*.json`, валидируются чистыми функциями и отображаются фиксированными премиальными компонентами. Одноразовые Node-скрипты читают локальную резервную копию и подготовленные сопоставления, копируют только оригинальные медиа и формируют отчёт полноты.

**Tech Stack:** React 19.2, Vite 6.4, JavaScript ES modules, Node.js test runner, Node.js migration scripts, existing Sites worker.

**Spec:** `docs/superpowers/specs/2026-08-27-iconamaster-full-content-migration-design.md`

**Working directories:** File lists and `npm`/`node` commands are relative to `premium-prototype/`; `git add` and `git commit` commands run from the Git repository root.

## Global Constraints

- Содержание изображений икон нельзя изменять генеративно или дорисовывать.
- Допустимы только нейтральная коррекция отображения, оптимизация файла и preview-кадрирование постороннего фона; полный оригинал использует `object-fit: contain`.
- Отсутствующее изображение не резервирует рамку, высоту или отступ.
- Тексты сохраняют исходный смысл; исправляются только кодировка, технический мусор и очевидные опечатки.
- Внутренние ссылки открываются в той же вкладке и строятся от корня сайта.
- Видео и звук не запускаются автоматически.
- WhatsApp `+7 916 655-45-95` — основной сценарий; телефон и `iconamaster@yandex.ru` остаются видимыми.
- Не добавлять корзину, оплату, личный кабинет, новую CMS или runtime-зависимости без отдельного согласования.
- Основной `iconamaster.ru` не изменять; сначала локальная проверка, затем временная публичная версия прототипа.

---

### Task 1: Canonical content contract and validation

**Files:**
- Create: `src/content/schema.js`
- Create: `tests/unit/content-schema.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: raw objects loaded from JSON.
- Produces: `validateContentBundle(bundle): { ok: boolean, errors: string[] }`, `publishedIcons(bundle): IconRecord[]`, and the canonical record shapes used by every later task.

- [ ] **Step 1: Write the failing contract tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { publishedIcons, validateContentBundle } from '../../src/content/schema.js';

const validImage = {
  src: '/assets/icons/example.jpg',
  alt: 'Икона, полный вид',
  width: 1200,
  height: 1600,
  fit: 'contain',
  position: '50% 50%'
};

const validBundle = {
  version: 1,
  icons: [{
    id: 'icon-1', slug: 'example', title: 'Пример', published: true,
    availability: 'В наличии', price: null, order: 10,
    type: 'Авторские', period: 'Современные', size: '', technique: '',
    origin: '', condition: '', expertise: '', description: '',
    sourceUrl: 'https://iconamaster.ru/example/', images: [validImage]
  }],
  pages: [], articles: [], videos: [], contacts: {
    whatsapp: '79166554595', phone: '+79166554595', email: 'iconamaster@yandex.ru'
  }, aliases: {}
};

test('validates the canonical content bundle', () => {
  assert.deepEqual(validateContentBundle(validBundle), { ok: true, errors: [] });
});

test('rejects a published icon without an image', () => {
  const bundle = structuredClone(validBundle);
  bundle.icons[0].images = [];
  assert.match(validateContentBundle(bundle).errors.join('\n'), /published icon example has no images/);
});

test('publishedIcons sorts records and excludes unpublished records', () => {
  const bundle = structuredClone(validBundle);
  bundle.icons.push({ ...bundle.icons[0], id: 'icon-2', slug: 'hidden', published: false, order: 1 });
  assert.deepEqual(publishedIcons(bundle).map(({ slug }) => slug), ['example']);
});
```

- [ ] **Step 2: Register and run the test to verify failure**

Add `tests/unit/content-schema.test.mjs` to the existing `test` script.

Run: `node --test --test-name-pattern="canonical content bundle|published icon|publishedIcons" tests/unit/content-schema.test.mjs`
Expected: FAIL because `src/content/schema.js` does not exist.

- [ ] **Step 3: Implement strict, dependency-free validation**

```js
const requiredCollections = ['icons', 'pages', 'articles', 'videos'];

export function validateContentBundle(bundle) {
  const errors = [];
  if (bundle?.version !== 1) errors.push('content version must be 1');
  for (const key of requiredCollections) {
    if (!Array.isArray(bundle?.[key])) errors.push(`${key} must be an array`);
  }
  const slugs = new Set();
  for (const icon of bundle?.icons ?? []) {
    if (!icon.slug) errors.push('icon slug is required');
    if (slugs.has(icon.slug)) errors.push(`duplicate icon slug ${icon.slug}`);
    slugs.add(icon.slug);
    if (icon.published && !(icon.images?.length > 0)) {
      errors.push(`published icon ${icon.slug} has no images`);
    }
    for (const image of icon.images ?? []) {
      if (!image.src || !image.alt || !(image.width > 0) || !(image.height > 0)) {
        errors.push(`invalid image in icon ${icon.slug}`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

export function publishedIcons(bundle) {
  return (bundle.icons ?? [])
    .filter((icon) => icon.published && icon.images?.length)
    .toSorted((left, right) => left.order - right.order);
}
```

- [ ] **Step 4: Run the focused and complete unit suite**

Run: `node --test --test-name-pattern="canonical content bundle|published icon|publishedIcons" tests/unit/content-schema.test.mjs`
Expected: PASS.

Run: `npm test`
Expected: all existing and new unit tests PASS.

- [ ] **Step 5: Commit the content contract**

```bash
git add premium-prototype/src/content/schema.js premium-prototype/tests/unit/content-schema.test.mjs premium-prototype/package.json
git commit -m "feat: define canonical content contract"
```

---

### Task 2: JSON content loader with an always-visible shell

**Files:**
- Create: `public/content/manifest.json`
- Create: `public/content/icons.json`
- Create: `public/content/pages.json`
- Create: `public/content/articles.json`
- Create: `public/content/videos.json`
- Create: `public/content/contacts.json`
- Create: `public/content/aliases.json`
- Create: `src/content/load-content.js`
- Create: `src/content/ContentProvider.jsx`
- Create: `tests/unit/content-loader.test.mjs`
- Modify: `src/App.jsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: `/content/manifest.json` and the six content documents named by it.
- Produces: `loadContent(fetchImpl): Promise<ContentBundle>` and `useContent(): { status, bundle, error }`.

- [ ] **Step 1: Write failing loader tests with an injected fetch**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadContent } from '../../src/content/load-content.js';

test('loads every document named by the manifest', async () => {
  const responses = new Map([
    ['/content/manifest.json', { version: 1, files: {
      icons: 'icons.json', pages: 'pages.json', articles: 'articles.json',
      videos: 'videos.json', contacts: 'contacts.json', aliases: 'aliases.json'
    }}],
    ['/content/icons.json', []], ['/content/pages.json', []],
    ['/content/articles.json', []], ['/content/videos.json', []],
    ['/content/contacts.json', { whatsapp: '79166554595', phone: '+79166554595', email: 'iconamaster@yandex.ru' }],
    ['/content/aliases.json', {}]
  ]);
  const bundle = await loadContent(async (url) => ({
    ok: responses.has(url), json: async () => responses.get(url)
  }));
  assert.equal(bundle.version, 1);
  assert.deepEqual(bundle.icons, []);
});

test('reports the exact failed content URL', async () => {
  await assert.rejects(
    loadContent(async () => ({ ok: false, status: 503 })),
    /failed to load \/content\/manifest.json: 503/
  );
});
```

- [ ] **Step 2: Run the loader tests to verify failure**

Run: `node --test tests/unit/content-loader.test.mjs`
Expected: FAIL because `load-content.js` does not exist.

- [ ] **Step 3: Implement manifest-based loading and validation**

```js
import { validateContentBundle } from './schema.js';

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`failed to load ${url}: ${response.status}`);
  return response.json();
}

export async function loadContent(fetchImpl = fetch) {
  const manifest = await getJson(fetchImpl, '/content/manifest.json');
  const entries = await Promise.all(Object.entries(manifest.files).map(async ([key, file]) => [
    key, await getJson(fetchImpl, `/content/${file}`)
  ]));
  const bundle = { version: manifest.version, ...Object.fromEntries(entries) };
  const validation = validateContentBundle(bundle);
  if (!validation.ok) throw new Error(validation.errors.join('\n'));
  return bundle;
}
```

Create `ContentProvider` so `SiteHeader` and `SiteFooter` render immediately, while the main area shows a compact loading state with no full-screen blank overlay. On error, show a retry button and the existing navigation.

- [ ] **Step 4: Seed JSON with the six already verified prototype icons**

Move the current records from `src/data/icons.js` into `public/content/icons.json` without changing image paths or descriptive values. Create empty arrays for pages, articles and videos, canonical contacts, an empty alias object, and the manifest.

Run: `node --test tests/unit/content-loader.test.mjs && npm test`
Expected: PASS.

- [ ] **Step 5: Build and smoke-test the asynchronous application**

Run: `npm run build`
Expected: Vite build succeeds and `dist/client/content/manifest.json` exists after Sites preparation.

- [ ] **Step 6: Commit the JSON loading boundary**

```bash
git add premium-prototype/public/content premium-prototype/src/content premium-prototype/src/App.jsx premium-prototype/tests/unit/content-loader.test.mjs premium-prototype/package.json
git commit -m "feat: load site content from validated JSON"
```

---

### Task 3: Canonical routes and legacy aliases

**Files:**
- Modify: `src/lib/routing.js`
- Modify: `src/App.jsx`
- Modify: `public/content/aliases.json`
- Modify: `tests/unit/routing.test.mjs`

**Interfaces:**
- Consumes: `aliases: Record<string, string>` from the content bundle.
- Produces: `parseRoute(pathname, aliases)` for home, collection, icon, workshop, service, article index, article, video, contacts and not-found routes.

- [ ] **Step 1: Replace the three-route expectation with the complete route matrix**

```js
test('parseRoute recognizes canonical pages and legacy aliases', () => {
  const aliases = {
    '/IKONY-V-NALICIE': '/collection',
    '/RESTAVRATIY': '/restoration',
    '/STAT-I': '/articles'
  };
  assert.deepEqual(parseRoute('/collection', aliases), { name: 'collection' });
  assert.deepEqual(parseRoute('/icons/alexander-peresvet', aliases), { name: 'icon', slug: 'alexander-peresvet' });
  assert.deepEqual(parseRoute('/articles/guslitsa', aliases), { name: 'article', slug: 'guslitsa' });
  assert.deepEqual(parseRoute('/RESTAVRATIY/', aliases), { name: 'page', slug: 'restoration', canonicalPath: '/restoration' });
});
```

- [ ] **Step 2: Run the route test to verify failure**

Run: `node --test tests/unit/routing.test.mjs`
Expected: FAIL because aliases and the new routes are unsupported.

- [ ] **Step 3: Implement path normalization before matching**

```js
function normalizePath(pathname) {
  const decoded = decodeURI(pathname || '/');
  return decoded !== '/' && decoded.endsWith('/') ? decoded.slice(0, -1) : decoded;
}

export function parseRoute(pathname, aliases = {}) {
  const requestedPath = normalizePath(pathname);
  const canonicalPath = aliases[requestedPath] ?? requestedPath;
  if (canonicalPath === '/') return { name: 'home' };
  if (canonicalPath === '/collection') return { name: 'collection' };
  if (canonicalPath === '/articles') return { name: 'articles' };
  if (canonicalPath === '/video') return { name: 'video' };
  if (canonicalPath === '/contacts') return { name: 'contacts' };
  const icon = canonicalPath.match(/^\/icons\/([^/]+)$/);
  if (icon) return { name: 'icon', slug: icon[1] };
  const article = canonicalPath.match(/^\/articles\/([^/]+)$/);
  if (article) return { name: 'article', slug: article[1] };
  const page = canonicalPath.match(/^\/(workshop|excursions|measure-icon|restoration|kiots|oklads|iconostases)$/);
  if (page) return { name: 'page', slug: page[1], canonicalPath };
  return { name: 'not-found' };
}
```

- [ ] **Step 4: Populate aliases for every current uppercase and Cargo path**

Include `/IKONY`, `/IKONY-V-NALICIE`, `/EKSKURSIY-PO-MASTERSKOI`, `/MERNAY-IKONA`, `/RESTAVRATIY`, `/KIOTY-I-REZ-BA`, `/OKLADY`, `/IKONOSTASY`, `/STAT-I`, `/VIDEO`, `/KONTAKTY` and every legacy icon/article path discovered by the migration inventory.

Run: `node --test tests/unit/routing.test.mjs`
Expected: PASS for canonical paths, trailing slashes and aliases.

- [ ] **Step 5: Commit compatible routing**

```bash
git add premium-prototype/src/lib/routing.js premium-prototype/src/App.jsx premium-prototype/public/content/aliases.json premium-prototype/tests/unit/routing.test.mjs
git commit -m "feat: support canonical and legacy content routes"
```

---

### Task 4: Reusable page, article, video and contact renderers

**Files:**
- Create: `src/lib/content-selectors.js`
- Create: `src/components/ContentSections.jsx`
- Create: `src/components/ContentGallery.jsx`
- Create: `src/components/VideoEmbed.jsx`
- Create: `src/pages/ContentPage.jsx`
- Create: `src/pages/ArticlesPage.jsx`
- Create: `src/pages/ArticlePage.jsx`
- Create: `src/pages/VideoPage.jsx`
- Create: `src/pages/ContactsPage.jsx`
- Create: `tests/unit/content-selectors.test.mjs`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `package.json`

**Interfaces:**
- Consumes: `pages`, `articles`, `videos`, and `contacts` from `useContent()`.
- Produces: fixed renderers that accept data only; rich text never provides style or script attributes.

- [ ] **Step 1: Write selector tests for valid blocks and missing media**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { renderableSections, selectBySlug } from '../../src/lib/content-selectors.js';

test('removes a missing image block without leaving a layout slot', () => {
  const sections = [
    { type: 'image', image: null },
    { type: 'text', heading: 'Реставрация', paragraphs: ['Текст'] }
  ];
  assert.deepEqual(renderableSections(sections), [sections[1]]);
});

test('selectBySlug returns null for an unpublished article', () => {
  assert.equal(selectBySlug([{ slug: 'hidden', published: false }], 'hidden'), null);
});
```

- [ ] **Step 2: Run the selector tests to verify failure**

Run: `node --test tests/unit/content-selectors.test.mjs`
Expected: FAIL because the selector module does not exist.

- [ ] **Step 3: Implement pure selectors and data-only components**

```js
export function selectBySlug(items, slug) {
  return items.find((item) => item.slug === slug && item.published !== false) ?? null;
}

export function renderableSections(sections = []) {
  return sections.filter((section) => {
    if (section.type === 'image') return Boolean(section.image?.src);
    if (section.type === 'gallery') return section.images?.some((image) => image?.src);
    if (section.type === 'text') return Boolean(section.heading || section.paragraphs?.length);
    return false;
  });
}
```

`ContentSections` maps only `text`, `image` and `gallery` blocks. It does not use `dangerouslySetInnerHTML`. `VideoEmbed` renders a real iframe only after a button click and always sets `autoplay=0`.

- [ ] **Step 4: Wire every route to the appropriate renderer**

Update `App.jsx` to resolve route data from the content bundle. Preserve `SiteHeader`, `SiteFooter` and the not-found page for every state.

Run: `npm test && npm run build`
Expected: PASS; all canonical route modules are included in the build.

- [ ] **Step 5: Commit the content page system**

```bash
git add premium-prototype/src/lib/content-selectors.js premium-prototype/src/components premium-prototype/src/pages premium-prototype/src/App.jsx premium-prototype/src/styles.css premium-prototype/tests/unit/content-selectors.test.mjs premium-prototype/package.json
git commit -m "feat: render structured pages articles and videos"
```

---

### Task 5: Reproducible legacy inventory

**Files:**
- Create: `scripts/lib/legacy-html.mjs`
- Create: `scripts/build-content-inventory.mjs`
- Create: `tests/fixtures/legacy/catalog.html`
- Create: `tests/fixtures/legacy/icon.html`
- Create: `tests/unit/legacy-inventory.test.mjs`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: a source directory passed by `--source`.
- Produces: `tmp/migration-inventory.json` containing source URL, local path, title and media URLs for each record.

- [ ] **Step 1: Add minimal CP1251/UTF-8 fixtures and failing extraction tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLinks, extractMediaUrls, repairMojibake } from '../../scripts/lib/legacy-html.mjs';

test('extracts unique absolute and root-relative media URLs', () => {
  const html = '<img data-src="https://files.cargocollective.com/a.jpg"><img src="/uploads/shop/bfull.jpg">';
  assert.deepEqual(extractMediaUrls(html), [
    'https://files.cargocollective.com/a.jpg', '/uploads/shop/bfull.jpg'
  ]);
});

test('does not alter valid Cyrillic while repairing known mojibake', () => {
  assert.equal(repairMojibake('Реставрация икон'), 'Реставрация икон');
  assert.equal(repairMojibake('Р РµСЃС‚Р°РІСЂР°С†РёСЏ'), 'Реставрация');
});
```

- [ ] **Step 2: Run the inventory tests to verify failure**

Run: `node --test tests/unit/legacy-inventory.test.mjs`
Expected: FAIL because the extractor does not exist.

- [ ] **Step 3: Implement targeted extraction for the known legacy markup**

Use named functions `extractLinks(html)`, `extractMediaUrls(html)`, `extractTitle(html)`, and `repairMojibake(text)`. Decode only known UTF-8-as-CP1251 corruption; never run a lossy conversion over already valid text. Sort and deduplicate every output list.

Add these scripts:

```json
{
  "migrate:inventory": "node scripts/build-content-inventory.mjs",
  "test:inventory": "node --test tests/unit/legacy-inventory.test.mjs"
}
```

- [ ] **Step 4: Generate and verify the real inventory**

Run:

```powershell
npm run migrate:inventory -- --source "C:\Users\user\Documents\ChatGPT\Iconamaster\backups\pre-optimized-publish-20260818"
```

Expected: `tmp/migration-inventory.json` reports 50 catalog links, 46 locally present icon pages, eight article links, the agreed service pages and the known image counts. It separately lists the four icon pages absent from the local backup.

- [ ] **Step 5: Commit the reproducible inventory tooling**

```bash
git add premium-prototype/scripts premium-prototype/tests/fixtures/legacy premium-prototype/tests/unit/legacy-inventory.test.mjs premium-prototype/.gitignore premium-prototype/package.json
git commit -m "feat: inventory legacy iconamaster content"
```

---

### Task 6: Migrate all icon records and immutable originals

**Files:**
- Create: `scripts/data/legacy-icon-map.mjs`
- Create: `scripts/migrate-icons.mjs`
- Create: `tests/unit/icon-migration.test.mjs`
- Modify: `scripts/icon-sources.mjs`
- Modify: `public/content/icons.json`
- Modify: `public/content/aliases.json`
- Modify: `public/assets/icons/manifest.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: `tmp/migration-inventory.json`, source HTML, existing verified icon assets and the explicit 50-entry legacy map.
- Produces: 50 canonical icon records before publication filtering, local original files, legacy aliases and `reports/icon-migration.json`.

- [ ] **Step 1: Write failing migration assertions**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('catalog migration contains all 50 source records and no duplicate slugs', async () => {
  const icons = JSON.parse(await readFile(new URL('../../public/content/icons.json', import.meta.url)));
  assert.equal(icons.length, 50);
  assert.equal(new Set(icons.map(({ slug }) => slug)).size, 50);
});

test('every published icon has a local original with dimensions and alt text', async () => {
  const icons = JSON.parse(await readFile(new URL('../../public/content/icons.json', import.meta.url)));
  for (const icon of icons.filter(({ published }) => published)) {
    assert.ok(icon.images.length > 0, icon.slug);
    for (const image of icon.images) {
      assert.match(image.src, /^\/assets\/icons\//);
      assert.ok(image.width > 0 && image.height > 0 && image.alt, `${icon.slug}: ${image.src}`);
    }
  }
});
```

- [ ] **Step 2: Run the migration tests to verify the current six-record failure**

Run: `node --test tests/unit/icon-migration.test.mjs`
Expected: FAIL with `6 !== 50`.

- [ ] **Step 3: Implement deterministic mapping and source provenance**

Each `legacy-icon-map.mjs` entry contains `legacyPath`, `slug`, `type`, `period`, `published`, and optional preview position. `migrate-icons.mjs` must fail on duplicate legacy paths, duplicate slugs, missing title, or an unaccounted catalog link. It must copy bytes without decoding or re-encoding image content and record a SHA-256 checksum in the asset manifest.

- [ ] **Step 4: Run migration and resolve every report item**

Run:

```powershell
node scripts/migrate-icons.mjs --source "C:\Users\user\Documents\ChatGPT\Iconamaster\backups\pre-optimized-publish-20260818" --inventory tmp/migration-inventory.json
```

For the four locally missing pages, retrieve originals from the public Iconamaster/Cargo source during execution, record their source URL, and rerun the script. If no original is available, keep the record with `published: false` and an empty image array; the frontend must not reserve a card or image slot.

- [ ] **Step 5: Verify content, assets and existing behavior**

Run: `node --test tests/unit/icon-migration.test.mjs && npm run test:assets && npm test && npm run build`
Expected: 50 source records, unique slugs, no missing files for published records, and all tests PASS.

- [ ] **Step 6: Commit the complete icon catalog**

```bash
git add premium-prototype/scripts premium-prototype/public/content/icons.json premium-prototype/public/content/aliases.json premium-prototype/public/assets/icons premium-prototype/reports/icon-migration.json premium-prototype/tests/unit/icon-migration.test.mjs premium-prototype/package.json
git commit -m "feat: migrate complete icon catalog"
```

---

### Task 7: Migrate service pages, articles, video and contacts

**Files:**
- Create: `scripts/data/legacy-page-map.mjs`
- Create: `scripts/data/legacy-article-map.mjs`
- Create: `scripts/migrate-editorial-content.mjs`
- Create: `tests/unit/editorial-migration.test.mjs`
- Modify: `public/content/pages.json`
- Modify: `public/content/articles.json`
- Modify: `public/content/videos.json`
- Modify: `public/content/contacts.json`
- Modify: `public/content/aliases.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: source inventory and explicit page/article maps.
- Produces: all agreed editorial records and `reports/editorial-migration.json`.

- [ ] **Step 1: Write exact-count and video-policy tests**

```js
test('editorial migration contains the agreed records', async () => {
  const pages = await json('../../public/content/pages.json');
  const articles = await json('../../public/content/articles.json');
  const videos = await json('../../public/content/videos.json');
  assert.deepEqual(pages.map(({ slug }) => slug).toSorted(), [
    'excursions', 'iconostases', 'kiots', 'measure-icon', 'oklads', 'restoration', 'workshop'
  ]);
  assert.equal(articles.length, 8);
  assert.deepEqual(videos.map(({ provider, id }) => `${provider}:${id}`), [
    'youtube:y10sw1KIOqQ', 'vimeo:353365425'
  ]);
  assert.ok(videos.every(({ autoplay }) => autoplay === false));
});
```

- [ ] **Step 2: Run the editorial test to verify failure**

Run: `node --test tests/unit/editorial-migration.test.mjs`
Expected: FAIL because the JSON files are still empty.

- [ ] **Step 3: Implement editorial migration with ordered blocks**

Convert legacy content into only these block forms:

```js
{ type: 'text', heading: '...', paragraphs: ['...'] }
{ type: 'image', image: { src: '/assets/pages/...', alt: '...', width: 1200, height: 800 } }
{ type: 'gallery', images: [{ src: '/assets/pages/...', alt: '...', width: 1200, height: 800 }] }
```

Drop an `image` block when its source cannot be recovered. Drop a `gallery` block when no valid images remain. Do not emit empty structural blocks.

- [ ] **Step 4: Run migration and inspect the corruption report**

Run:

```powershell
node scripts/migrate-editorial-content.mjs --source "C:\Users\user\Documents\ChatGPT\Iconamaster\backups\pre-optimized-publish-20260818" --inventory tmp/migration-inventory.json
```

Expected: seven service records, eight articles, two videos, canonical contacts, zero unresolved mojibake markers, and source URLs for every record.

- [ ] **Step 5: Verify all migrated editorial content**

Run: `node --test tests/unit/editorial-migration.test.mjs && npm test && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit editorial content**

```bash
git add premium-prototype/scripts premium-prototype/public/content premium-prototype/public/assets/pages premium-prototype/public/assets/articles premium-prototype/reports/editorial-migration.json premium-prototype/tests/unit/editorial-migration.test.mjs premium-prototype/package.json
git commit -m "feat: migrate workshop pages and articles"
```

---

### Task 8: Premium navigation and complete page composition

**Files:**
- Modify: `src/components/SiteHeader.jsx`
- Modify: `src/components/SiteFooter.jsx`
- Modify: `src/components/ConsultationLinks.jsx`
- Modify: `src/pages/HomePage.jsx`
- Modify: `src/pages/CollectionPage.jsx`
- Modify: `src/pages/IconDetailPage.jsx`
- Modify: `src/styles.css`
- Modify: `tests/unit/shell-layout.test.mjs`
- Modify: `tests/unit/hardening.test.mjs`

**Interfaces:**
- Consumes: canonical route paths and contacts from `useContent()`.
- Produces: one desktop menu, one mobile menu, consistent consultation actions and fixed premium composition for every page type.

- [ ] **Step 1: Extend hardening tests for navigation and empty media**

```js
test('navigation uses root-relative same-tab links', async () => {
  const source = await readFile(new URL('../../src/components/SiteHeader.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /target=["']_blank["']/);
  for (const path of ['/collection', '/restoration', '/articles', '/video', '/contacts']) {
    assert.match(source, new RegExp(`href=["']${path}["']`));
  }
});

test('content renderers do not emit placeholders for missing images', async () => {
  const source = await readFile(new URL('../../src/components/ContentSections.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /image-placeholder|empty-image|reserved-media/);
});
```

- [ ] **Step 2: Run the tests to verify failure against the old header**

Run: `node --test tests/unit/shell-layout.test.mjs tests/unit/hardening.test.mjs`
Expected: FAIL because the complete route set is absent.

- [ ] **Step 3: Implement the agreed menu and consultation hierarchy**

Use top-level links for Home, Collection, Restoration, Articles, Video and Contacts. Put Excursions, Measure Icon, Kiots, Oklads and Iconostases under Workshop. Keep the mobile menu in document flow or an isolated overlay that never competes with gallery stacking contexts.

- [ ] **Step 4: Normalize icon detail navigation and gallery flow**

Place “В каталог” and “Следующая икона” directly after the icon information instead of at viewport height. Hide the next link only when the published catalog is empty. Failed gallery items are removed and do not leave width, height or margins.

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit the complete premium shell**

```bash
git add premium-prototype/src premium-prototype/tests/unit
git commit -m "feat: complete premium site navigation and layouts"
```

---

### Task 9: Asset, link and performance gates

**Files:**
- Create: `scripts/verify-content.mjs`
- Create: `tests/unit/content-integrity.test.mjs`
- Modify: `scripts/verify-icon-assets.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: all JSON documents and local assets.
- Produces: a non-zero exit code for a broken source reference, duplicate slug, missing local file, published icon without images, unrecognized alias target, autoplay flag or empty content block.

- [ ] **Step 1: Write a failing integrity test against a broken fixture**

```js
test('integrity validator reports a missing asset and empty image block', () => {
  const errors = verifyContent({
    version: 1,
    icons: [{ slug: 'broken', published: true, images: [{ src: '/assets/icons/missing.jpg' }] }],
    pages: [{ slug: 'page', sections: [{ type: 'image', image: null }] }],
    articles: [], videos: [], contacts: {}, aliases: {}
  }, new Set());
  assert.deepEqual(errors, [
    'published icon broken references missing /assets/icons/missing.jpg',
    'page page contains an empty image block'
  ]);
});
```

- [ ] **Step 2: Run the integrity test to verify failure**

Run: `node --test tests/unit/content-integrity.test.mjs`
Expected: FAIL because `verifyContent` does not exist.

- [ ] **Step 3: Implement the verifier and package gate**

Add scripts:

```json
{
  "test:content": "node scripts/verify-content.mjs",
  "verify": "npm test && npm run test:content && npm run test:assets && npm run build && npm run test:sites"
}
```

The verifier must walk every section and image recursively, resolve `/assets/...` under `public`, and validate every alias target by calling `parseRoute`.

- [ ] **Step 4: Run the complete gate**

Run: `npm run verify`
Expected: all unit tests PASS, no integrity error, no missing asset, production build succeeds and Sites worker tests PASS.

- [ ] **Step 5: Commit the release gates**

```bash
git add premium-prototype/scripts/verify-content.mjs premium-prototype/scripts/verify-icon-assets.mjs premium-prototype/tests/unit/content-integrity.test.mjs premium-prototype/package.json
git commit -m "test: gate complete content and assets"
```

---

### Task 10: Browser QA, migration report and temporary publication

**Files:**
- Create: `reports/content-qa.md`
- Modify: `design-qa.md`
- Modify: `.openai/hosting.json` only if the existing public preview configuration requires its current deployment identifier to be preserved.

**Interfaces:**
- Consumes: the verified production build.
- Produces: visual QA evidence, a signed-off migration report and an updated temporary public preview.

- [ ] **Step 1: Start the verified local preview**

Run: `npm run dev -- --host 127.0.0.1`
Expected: Vite reports a local URL and the shell is visible before gallery images finish loading.

- [ ] **Step 2: Test the route matrix at four widths**

Use the chosen in-app browser at desktop, tablet, 390 px and 360 px. Check `/`, `/collection`, one multi-image icon, one single-image icon, every service page, article index, one long article, `/video`, `/contacts`, one legacy alias and one unknown route.

Record each result in `reports/content-qa.md` with viewport, route, PASS/FAIL and the exact correction made. Confirm no overlap, horizontal scrolling, blank media boxes, large empty gaps, autoplay, stale navigation or new-tab internal links.

- [ ] **Step 3: Compare reference and final layouts**

Capture the approved premium reference and the final local page at the same viewport. Compare them together for hierarchy, typography, spacing, crops, borders and CTA placement. Correct visible regressions, rerun `npm run verify`, and repeat the comparison.

- [ ] **Step 4: Verify performance and network behavior**

On a clean mobile navigation, confirm the header and first meaningful content render without waiting for below-fold galleries. Confirm image requests below the fold are lazy and iframe requests do not start before a video click. Record measured values and any external hosting limitation in `reports/content-qa.md`.

- [ ] **Step 5: Update the temporary public prototype**

Run: `npm run verify` immediately before deployment. Use the existing Sites hosting configuration and preserve public access already authorized by the user. Do not deploy to `iconamaster.ru`.

Verify the public preview from a fresh browser context at `/`, `/collection`, one icon, one article, `/video` and a legacy alias.

- [ ] **Step 6: Commit QA evidence**

```bash
git add premium-prototype/reports/content-qa.md premium-prototype/design-qa.md
git commit -m "docs: verify complete premium content migration"
```

---

## Completion checkpoint

Plan 1 is complete only when the temporary public prototype contains the full verified content set and passes `npm run verify`. Do not begin production Corona integration until the user has inspected this prototype and accepted the migrated content and page behavior.
