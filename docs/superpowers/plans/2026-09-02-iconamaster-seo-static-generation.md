# Iconamaster SEO Static Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate complete crawlable HTML for every published Iconamaster page, add route-specific SEO and analytics, publish a commercial mural-cleaning page, and expose one verified workshop address.

**Architecture:** Keep the React/Vite client and add a build-time React server-rendering entry plus a static-site orchestration script. The build enumerates canonical routes from the committed content bundle, writes route-specific HTML and crawl files, hydrates matching HTML in the browser, and generates Apache redirects for legacy aliases with a real 404 for unknown paths.

**Tech Stack:** React 19, React DOM server rendering and hydration, Vite 6, Node.js 20.19+ built-in test runner, Apache `.htaccess`, Yandex Metrica, OpenSSH/SCP for MTW release.

**Spec:** `docs/superpowers/specs/2026-09-02-iconamaster-seo-static-generation-design.md`

## Global Constraints

- Canonical site URL is exactly `https://iconamaster.ru`.
- Yandex Metrica counter ID is exactly `112185835`; do not restore legacy counter `17785549`.
- Canonical address is exactly `Московская область, д. Брёхово, Ромашковая ул., 16`.
- Canonical map URL is exactly `https://yandex.com/maps/-/CTT2bAoq`.
- Preserve the approved dark museum layout and all immutable original icon files.
- WhatsApp remains primary; phone and email remain visible alternatives.
- Do not infer or edit icon categories or availability values in this work.
- Do not state unverified licenses, qualifications, ratings, availability, prices, geography, or guarantees.
- Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` unchanged.
- Before MTW deployment, run the full verification gate, commit, and push the exact source to `https://github.com/Kiffirchik/iconamaster.ru`.
- Preserve a complete rollback directory and archive on MTW; preserve Corona, `config.php`, `uploads`, and `captcha`.

## File Structure

- `src/data/site-config.js`: canonical site identity and Metrica ID only.
- `src/lib/routing.js`: canonical path enumeration and route parsing.
- `src/lib/seo.js`: pure metadata and JSON-LD descriptor generation.
- `src/lib/analytics.js`: safe Metrica goal dispatch.
- `src/content/ContentProvider.jsx`: initial server/client bundle support.
- `src/App.jsx`: path-injected rendering and client SEO synchronization.
- `src/entry-server.jsx`: build-time React rendering interface.
- `src/main.jsx`: content-first hydration bootstrap.
- `src/pages/MuralCleaningPage.jsx`: commercial composition for the data-backed service page.
- `scripts/data/manual-pages.mjs`: durable source for the non-Cargo commercial page.
- `scripts/lib/static-site.mjs`: HTML, Sitemap, robots, 404, and Apache rule generators.
- `scripts/prerender.mjs`: filesystem orchestration for all generated routes.
- `scripts/prepare-mtw-build.mjs`: preserve generated routing output while applying approved image derivatives.
- `tests/unit/seo.test.mjs`: descriptor, JSON-LD, and route enumeration tests.
- `tests/unit/analytics.test.mjs`: goal dispatch tests.
- `tests/unit/mural-service.test.mjs`: service content, routing, and CTA tests.
- `tests/unit/prerender.test.mjs`: pure static-output and Apache-generation tests.
- `tests/static-build.test.mjs`: post-build artifact contract.

---

### Task 1: Canonical site and contact contract

**Files:**
- Create: `src/data/site-config.js`
- Modify: `public/content/contacts.json`
- Modify: `src/content/schema.js`
- Modify: `scripts/verify-content.mjs`
- Modify: `src/pages/ContactsPage.jsx`
- Modify: `src/components/SiteFooter.jsx`
- Modify: `tests/unit/contacts.test.mjs`
- Modify: `tests/unit/content-schema.test.mjs`
- Modify: `tests/unit/content-integrity.test.mjs`
- Modify: `tests/unit/content-renderers.test.mjs`

**Interfaces:**
- Consumes: existing phone, WhatsApp, email, and content bundle.
- Produces: `siteConfig: Readonly<{ name: string, url: string, locale: string, metrikaId: number }>` and `contacts.address: { display, streetAddress, addressLocality, addressRegion, addressCountry }`, plus `contacts.mapUrl`.

- [ ] **Step 1: Write failing tests for canonical identity and address validation**

Add assertions equivalent to:

```js
import { siteConfig } from '../../src/data/site-config.js';

assert.deepEqual(siteConfig, {
  name: 'Московская иконописная мастерская',
  url: 'https://iconamaster.ru',
  locale: 'ru_RU',
  metrikaId: 112185835,
});

assert.deepEqual(canonicalContacts.address, {
  display: 'Московская область, д. Брёхово, Ромашковая ул., 16',
  streetAddress: 'Ромашковая ул., 16',
  addressLocality: 'д. Брёхово',
  addressRegion: 'Московская область',
  addressCountry: 'RU',
});
assert.equal(canonicalContacts.mapUrl, 'https://yandex.com/maps/-/CTT2bAoq');
```

Add negative schema and integrity cases for a missing `display`, a non-`RU` country value, an HTTP map URL, and unknown nested address fields.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```powershell
node --test tests/unit/contacts.test.mjs tests/unit/content-schema.test.mjs tests/unit/content-integrity.test.mjs tests/unit/content-renderers.test.mjs
```

Expected: FAIL because `site-config.js`, address fields, validators, and rendered address do not exist.

- [ ] **Step 3: Add the canonical configuration and contact data**

Create `src/data/site-config.js` with exactly:

```js
export const siteConfig = Object.freeze({
  name: 'Московская иконописная мастерская',
  url: 'https://iconamaster.ru',
  locale: 'ru_RU',
  metrikaId: 112185835,
});
```

Extend `public/content/contacts.json` with:

```json
"mapUrl": "https://yandex.com/maps/-/CTT2bAoq",
"address": {
  "display": "Московская область, д. Брёхово, Ромашковая ул., 16",
  "streetAddress": "Ромашковая ул., 16",
  "addressLocality": "д. Брёхово",
  "addressRegion": "Московская область",
  "addressCountry": "RU"
}
```

Allow and validate these exact fields in both runtime and durable content validators. Retain the existing `sourceUrl` and communication values.

- [ ] **Step 4: Render one canonical address and map link**

In `ContactsPage`, render:

```jsx
<address>{contacts.address.display}</address>
<a href={contacts.mapUrl} target="_blank" rel="noreferrer">Открыть в Яндекс Картах</a>
```

In `SiteFooter`, render `д. Брёхово, Московская область` from `bundle.contacts.address`, not from another hardcoded address. Obtain contacts from the existing content context.

- [ ] **Step 5: Run tests and commit**

Run the focused command from Step 2, then `npm test`. Expected: all pass.

```powershell
git add src/data/site-config.js public/content/contacts.json src/content/schema.js scripts/verify-content.mjs src/pages/ContactsPage.jsx src/components/SiteFooter.jsx tests/unit/contacts.test.mjs tests/unit/content-schema.test.mjs tests/unit/content-integrity.test.mjs tests/unit/content-renderers.test.mjs
git commit -m "feat: define canonical workshop contact data"
```

---

### Task 2: Data-backed mural-cleaning service page

**Files:**
- Create: `scripts/data/manual-pages.mjs`
- Create: `src/pages/MuralCleaningPage.jsx`
- Create: `tests/unit/mural-service.test.mjs`
- Modify: `scripts/migrate-editorial-content.mjs`
- Modify: `public/content/pages.json`
- Modify: `reports/editorial-migration.json`
- Modify: `src/content/schema.js`
- Modify: `scripts/verify-content.mjs`
- Modify: `src/lib/routing.js`
- Modify: `src/App.jsx`
- Modify: `src/components/ConsultationLinks.jsx`
- Modify: `src/lib/contacts.js`
- Modify: `src/components/SiteHeader.jsx`
- Modify: `src/components/SiteFooter.jsx`
- Modify: `src/pages/ArticlePage.jsx`
- Modify: `src/styles.css`
- Modify: `tests/unit/app-routing.test.mjs`
- Modify: `tests/unit/routing.test.mjs`
- Modify: `tests/unit/editorial-migration.test.mjs`
- Modify: `tests/unit/content-integrity.test.mjs`

**Interfaces:**
- Consumes: three images and verified copy from article `restoration-murals-cleaning`.
- Produces: page record `slug: 'raschistka-hramovyh-rospisey'`, `template: 'service'`; route `{ name: 'page', slug: 'raschistka-hramovyh-rospisey' }`; contact mode `'murals'`.

- [ ] **Step 1: Write failing route, migration, rendering, and copy tests**

Require these facts:

```js
const path = '/raschistka-hramovyh-rospisey';
assert.deepEqual(parseRoute(path), {
  name: 'page',
  slug: 'raschistka-hramovyh-rospisey',
  canonicalPath: path,
});

assert.equal(service.template, 'service');
assert.equal(service.sourceUrl, 'https://dzen.ru/a/ak_PywErdWEdTZrn');
assert.equal(service.sections.filter((section) => section.type === 'image').length, 3);
assert.match(renderedText, /от одного до двух месяцев/u);
assert.match(renderedText, /Получить предварительную консультацию/u);
assert.match(renderedText, /Подробный материал о технологии/u);
```

Assert that the migration output contains 8 pages, the project verifier summary reports 8 pages, and the existing 10 articles remain unchanged.

- [ ] **Step 2: Run focused tests and verify failure**

```powershell
node --test tests/unit/mural-service.test.mjs tests/unit/routing.test.mjs tests/unit/app-routing.test.mjs tests/unit/editorial-migration.test.mjs tests/unit/content-integrity.test.mjs
```

Expected: FAIL because the service record, template, component, and route do not exist.

- [ ] **Step 3: Define the durable manual page record**

Export `manualPages` from `scripts/data/manual-pages.mjs`. The record must use:

```js
{
  id: 'mural-cleaning-service',
  slug: 'raschistka-hramovyh-rospisey',
  title: 'Расчистка настенных храмовых росписей от копоти и загрязнений',
  intro: 'Бережно удаляем копоть и загрязнения с храмовой стенописи, укрепляем повреждённые участки и сохраняем действующую роспись.',
  published: true,
  order: 8,
  template: 'service',
  consultationTopic: 'murals',
  relatedArticleSlug: 'restoration-murals-cleaning',
  sourceUrl: 'https://dzen.ru/a/ak_PywErdWEdTZrn',
  sections: [
    {
      type: 'image',
      image: {
        src: '/assets/articles/dzen/restoration-murals-cleaning-1.jpg',
        alt: 'Роспись храма до и после расчистки от копоти и загрязнений',
        width: 1243,
        height: 799,
      },
    },
    {
      type: 'text',
      heading: 'Что входит в работу',
      paragraphs: [
        'Расчищаем настенную храмовую живопись от копоти и загрязнений небольшими участками, чтобы размягчённые наслоения не проникли в красочный слой.',
        'При необходимости в ходе работ укрепляем основу, штукатурный и красочный слой, а повреждённые участки восстанавливают художники-иконописцы.',
      ],
    },
    {
      type: 'text',
      heading: 'Как проходит расчистка',
      paragraphs: [
        'Наслоения размягчаются специально подобранными составами и сразу удаляются. Работа требует высокой интенсивности и опыта, поскольку ошибка может закрепить загрязнение внутри красочного слоя.',
        'Работы ведутся с подвижных сборно-разборных конструкций типа «тура». Такой способ ускоряет доступ к участкам росписи и уменьшает объём стационарных лесов.',
      ],
    },
    {
      type: 'image',
      image: {
        src: '/assets/articles/dzen/restoration-murals-cleaning-2.jpg',
        alt: 'Восстановление утраченных фрагментов росписи в храме Пресвятой Троицы на Сходне',
        width: 1200,
        height: 896,
      },
    },
    {
      type: 'text',
      heading: 'Выполненные работы',
      paragraphs: [
        'В Храме Иконы Пресвятой Богородицы «Знамение» на Речном вокзале выполнена расчистка стенописи с наглядным результатом до и после.',
        'В Храме Пресвятой Троицы на Сходне выполнена допись утраченных фрагментов росписи.',
        'В Храме Петра и Павла в Химках проводилась расчистка настенных росписей свода купола.',
      ],
    },
    {
      type: 'image',
      image: {
        src: '/assets/articles/dzen/restoration-murals-cleaning-3.jpg',
        alt: 'Расчистка настенных росписей свода купола храма Петра и Павла в Химках',
        width: 960,
        height: 1280,
      },
    },
    {
      type: 'text',
      heading: 'Сроки и организация',
      paragraphs: [
        'Расчистка росписей небольшого храма занимает в среднем от одного до двух месяцев.',
        'Подвижные конструкции позволяют организовать работу так, чтобы не прекращать функционирование храма.',
      ],
    },
  ],
}
```

Append this record deterministically after migrated Cargo pages, update the migration report, and teach validators the four service-only fields. Permit the Dzen source only for this exact service template while keeping the Cargo requirement for ordinary pages.

- [ ] **Step 4: Render the specialized page and thematic contact links**

Implement `MuralCleaningPage` with the existing `editorial-page`, `ContentSections`, button, and consultation styles. Add a leading and closing `ConsultationLinks topic="murals"` and a same-tab link to `/articles/restoration-murals-cleaning`.

Extend `buildContactLinks(contacts, iconTitle, mode)` so `mode === 'murals'` produces:

```text
Здравствуйте! Нужна консультация по расчистке настенных храмовых росписей.
```

Select `MuralCleaningPage` only when `page.template === 'service'`. Add ordinary `href` links labelled `Расчистка росписей` to the workshop navigation and footer. On the related article, add `Обсудить расчистку росписей` linking to the service path.

- [ ] **Step 5: Normalize address prose without changing legitimate Зеленоград references**

Change only the two workshop-location paragraphs in `public/content/pages.json` to the exact address `Московская область, д. Брёхово, Ромашковая ул., 16`. Do not alter the Георгиевский-hрам article, its title, alt text, or the excursion phrase that uses Зеленоград as a geographic landmark.

- [ ] **Step 6: Run tests and commit**

Run the focused command from Step 2, `npm run test:content`, and `npm test`. Expected: all pass with 8 pages and unchanged icon data.

```powershell
git add scripts/data/manual-pages.mjs src/pages/MuralCleaningPage.jsx tests/unit/mural-service.test.mjs scripts/migrate-editorial-content.mjs public/content/pages.json reports/editorial-migration.json src/content/schema.js scripts/verify-content.mjs src/lib/routing.js src/App.jsx src/components/ConsultationLinks.jsx src/lib/contacts.js src/components/SiteHeader.jsx src/components/SiteFooter.jsx src/pages/ArticlePage.jsx src/styles.css tests/unit/app-routing.test.mjs tests/unit/routing.test.mjs tests/unit/editorial-migration.test.mjs tests/unit/content-integrity.test.mjs
git commit -m "feat: add mural cleaning service page"
```

---

### Task 3: Canonical route SEO descriptors and structured data

**Files:**
- Create: `src/lib/seo.js`
- Create: `tests/unit/seo.test.mjs`
- Modify: `src/lib/routing.js`

**Interfaces:**
- Consumes: `siteConfig`, a normalized pathname, and the validated content bundle.
- Produces: `listCanonicalPaths(bundle): string[]`, `buildSeoDescriptor(pathname, bundle): SeoDescriptor`, `serializeJsonLd(value): string`.

- [ ] **Step 1: Write failing canonical path tests**

Use a fixture with two icons, two pages including the service template, one article, videos, contacts, and one alias. Require this ordered output:

```js
assert.deepEqual(listCanonicalPaths(bundle), [
  '/',
  '/collection',
  '/icons/first-icon',
  '/icons/second-icon',
  '/workshop',
  '/raschistka-hramovyh-rospisey',
  '/articles',
  '/articles/first-article',
  '/video',
  '/contacts',
]);
```

Require unpublished records and aliases to be absent.

- [ ] **Step 2: Write failing descriptor and JSON-LD tests**

For home, collection, service, article, one priced/available icon, one incompletely classified icon, contacts, and missing path, assert:

```js
assert.equal(home.canonical, 'https://iconamaster.ru/');
assert.match(service.title, /Расчистка настенных храмовых росписей/u);
assert.equal(article.openGraph.type, 'article');
assert.equal(icon.openGraph.image, 'https://iconamaster.ru/assets/icons/example.jpg');
assert.equal(missing.robots, 'noindex,follow');
assert.doesNotMatch(JSON.stringify(incompleteIcon.structuredData), /"Offer"/u);
assert.match(JSON.stringify(contacts.structuredData), /Ромашковая ул\., 16/u);
assert.equal(JSON.parse(serializeJsonLd({ text: '</script>' })).text, '</script>');
assert.doesNotMatch(serializeJsonLd({ text: '</script>' }), /<\/script>/u);
```

- [ ] **Step 3: Run tests and verify failure**

```powershell
node --test tests/unit/seo.test.mjs
```

Expected: FAIL because route enumeration and descriptors do not exist.

- [ ] **Step 4: Implement pure route enumeration and metadata selection**

`listCanonicalPaths` must use only records where `published !== false`, preserve content order, return each path once, and use root-relative paths. `buildSeoDescriptor` returns:

```js
{
  title,
  description,
  canonical,
  robots: 'index,follow',
  openGraph: { title, description, url: canonical, type, locale: 'ru_RU', image },
  twitter: { card: image ? 'summary_large_image' : 'summary', title, description, image },
  structuredData: { '@context': 'https://schema.org', '@graph': [] },
}
```

Use `LocalBusiness` on home and contacts, `Service` on the mural page, `Article` on article routes, `VisualArtwork` on icon routes, and `BreadcrumbList` on every non-home route. Add `Product` and `Offer` only when a numeric RUB price and an explicitly sale-compatible availability value are both present. Never translate blank or `По запросу` availability into `InStock`.

- [ ] **Step 5: Implement safe text and JSON serialization**

Normalize whitespace, remove markup, and truncate descriptions at a word boundary near 160 characters. Serialize JSON-LD with `JSON.stringify` followed by replacements for `<`, `>`, `&`, U+2028, and U+2029 so user-authored text cannot terminate the script element.

- [ ] **Step 6: Run tests and commit**

```powershell
node --test tests/unit/seo.test.mjs tests/unit/routing.test.mjs
npm test
git add src/lib/seo.js src/lib/routing.js tests/unit/seo.test.mjs tests/unit/routing.test.mjs
git commit -m "feat: describe canonical SEO routes"
```

---

### Task 4: Yandex Metrica and contact goals

**Files:**
- Create: `src/lib/analytics.js`
- Create: `tests/unit/analytics.test.mjs`
- Modify: `src/components/ConsultationLinks.jsx`
- Modify: `src/pages/ContactsPage.jsx`
- Modify: `src/pages/MuralCleaningPage.jsx`

**Interfaces:**
- Consumes: `siteConfig.metrikaId`, optional `window.ym`, and a goal name.
- Produces: `trackGoal(goal: 'contact_whatsapp' | 'contact_phone' | 'contact_email' | 'murals_consultation', windowLike = window): boolean`.

- [ ] **Step 1: Write failing safe-dispatch tests**

```js
assert.equal(trackGoal('contact_phone', {}), false);

const calls = [];
const windowLike = { ym: (...args) => calls.push(args) };
assert.equal(trackGoal('contact_whatsapp', windowLike), true);
assert.deepEqual(calls, [[112185835, 'reachGoal', 'contact_whatsapp']]);

assert.throws(() => trackGoal('unknown_goal', windowLike), /Unsupported Metrica goal/u);
```

- [ ] **Step 2: Run the test and verify failure**

```powershell
node --test tests/unit/analytics.test.mjs
```

Expected: FAIL because `analytics.js` does not exist.

- [ ] **Step 3: Implement a strict non-blocking analytics helper**

Use a frozen allowed-goal set. Return `false` when `windowLike.ym` is not a function. Catch dispatch errors and return `false`; never cancel link navigation.

- [ ] **Step 4: Wire contact clicks**

Attach event handlers without calling `preventDefault`:

```jsx
onClick={() => trackGoal('contact_whatsapp')}
onClick={() => trackGoal('contact_phone')}
onClick={() => trackGoal('contact_email')}
```

For the primary mural CTA, dispatch `murals_consultation` and `contact_whatsapp` in that order. Preserve `target`, `rel`, href values, and accessibility labels.

- [ ] **Step 5: Run tests and commit**

```powershell
node --test tests/unit/analytics.test.mjs tests/unit/contacts.test.mjs tests/unit/mural-service.test.mjs
npm test
git add src/lib/analytics.js tests/unit/analytics.test.mjs src/components/ConsultationLinks.jsx src/pages/ContactsPage.jsx src/pages/MuralCleaningPage.jsx
git commit -m "feat: track workshop contact goals"
```

---

### Task 5: Server rendering and content-first hydration

**Files:**
- Create: `src/entry-server.jsx`
- Create: `tests/unit/server-rendering.test.mjs`
- Modify: `src/content/ContentProvider.jsx`
- Modify: `src/App.jsx`
- Modify: `src/main.jsx`
- Modify: `tests/unit/app-routing.test.mjs`
- Modify: `tests/unit/content-loader.test.mjs`

**Interfaces:**
- Consumes: `renderApp(pathname: string, bundle: ContentBundle)` at build time and `loadContent(fetch)` in the browser.
- Produces: `renderApp(...): { html: string, route: Route }`; client hydration that leaves prerendered HTML visible until the content bundle is ready.

- [ ] **Step 1: Write failing server-render tests**

Load `/src/entry-server.jsx` through Vite SSR in the test. Require:

```js
const result = renderApp('/raschistka-hramovyh-rospisey', bundle);
assert.equal(result.route.name, 'page');
assert.match(result.html, /<h1[^>]*>Расчистка настенных храмовых росписей/u);
assert.match(result.html, /href="\/collection"/u);
assert.match(result.html, /wa\.me\/79166554595/u);
assert.doesNotMatch(result.html, /Загружаем коллекцию/u);
```

Also require an icon path to contain its title, price, image dimensions, and an ordinary `href` back to `/collection`.

- [ ] **Step 2: Write failing initial-bundle tests**

Require `ContentProvider` with an initial bundle to expose `{ status: 'ready', bundle }` without calling fetch. Require `App initialPath="/contacts" initialBundle={bundle}` to render contacts on the first pass.

- [ ] **Step 3: Run tests and verify failure**

```powershell
node --test tests/unit/server-rendering.test.mjs tests/unit/app-routing.test.mjs tests/unit/content-loader.test.mjs
```

Expected: FAIL because there is no server entry and the provider cannot accept initial content.

- [ ] **Step 4: Add injected route and content state**

Refactor `App` to accept `initialBundle`, `initialError`, and `initialPath`. Initialize the provider as ready when `initialBundle` is present. Keep retry behavior for an initial or later error. Replace direct initial `window.location.pathname` reads with the injected path and use `window` only in effects and browser callbacks.

- [ ] **Step 5: Add the server entry**

Implement:

```jsx
import { renderToString } from 'react-dom/server';
import { App } from './App.jsx';
import { parseRoute } from './lib/routing.js';

export function renderApp(pathname, bundle) {
  const route = parseRoute(pathname, bundle.aliases);
  return {
    route,
    html: renderToString(<App initialBundle={bundle} initialPath={pathname} />),
  };
}
```

The implementation may pass the already parsed route internally to avoid duplicate work, but the exported signature and return shape stay exact.

- [ ] **Step 6: Bootstrap after data is ready and hydrate only a matching path**

In `main.jsx`, keep prerendered markup untouched while `loadContent()` runs. Build the React tree only after success. Use `hydrateRoot` when `container.dataset.prerenderPath` equals the normalized current pathname; otherwise use `createRoot`. On loading failure, use `createRoot` with `initialError` so the existing retry UI remains available.

- [ ] **Step 7: Keep route metadata synchronized in browser navigation**

In `AppContent`, derive `buildSeoDescriptor(window.location.pathname, bundle)` after each ready route change and call a DOM helper from `seo.js` that updates only elements marked `data-seo-managed="true"`. Do not create duplicate canonical, Open Graph, Twitter, or JSON-LD nodes.

- [ ] **Step 8: Run tests and commit**

```powershell
node --test tests/unit/server-rendering.test.mjs tests/unit/app-routing.test.mjs tests/unit/content-loader.test.mjs tests/unit/seo.test.mjs
npm test
git add src/entry-server.jsx tests/unit/server-rendering.test.mjs src/content/ContentProvider.jsx src/App.jsx src/main.jsx tests/unit/app-routing.test.mjs tests/unit/content-loader.test.mjs src/lib/seo.js tests/unit/seo.test.mjs
git commit -m "feat: render and hydrate content-first pages"
```

---

### Task 6: Static HTML, crawl files, redirects, and real 404

**Files:**
- Create: `scripts/lib/static-site.mjs`
- Create: `scripts/prerender.mjs`
- Create: `tests/unit/prerender.test.mjs`
- Modify: `index.html`
- Modify: `public/.htaccess`
- Modify: `scripts/prepare-mtw-build.mjs`
- Modify: `tests/mtw-deployment.test.mjs`
- Modify: `vite.config.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: built client template, built `renderApp`, `listCanonicalPaths(bundle)`, descriptors, contacts, and aliases.
- Produces: route `index.html` files, `404.html`, `robots.txt`, `sitemap.xml`, and generated `.htaccess` in `dist/client`.

- [ ] **Step 1: Write failing pure generator tests**

Export and test:

```js
renderDocument(template, { pathname, appHtml, seo, metrikaId })
buildSitemap(paths, 'https://iconamaster.ru')
buildRobots('https://iconamaster.ru/sitemap.xml')
buildApacheConfig(baseTemplate, { canonicalPaths, aliases })
outputPathForRoute(distRoot, pathname)
```

Require escaped HTML attributes, safely serialized JSON-LD, `data-prerender-path`, one managed canonical, one managed JSON-LD script, and one counter initialization. Require:

```js
assert.equal(outputPathForRoute('dist/client', '/'), path.join('dist/client', 'index.html'));
assert.equal(
  outputPathForRoute('dist/client', '/icons/example'),
  path.join('dist/client', 'icons', 'example', 'index.html'),
);
assert.match(buildRobots('https://iconamaster.ru/sitemap.xml'), /Disallow: \/corona\//u);
assert.doesNotMatch(buildSitemap(['/collection'], siteConfig.url), /lastmod/u);
```

For every non-root canonical path, require an internal rewrite from the exact clean path to its generated `index.html` before the real-directory guard, plus a 301 from its trailing-slash spelling to the clean path. This prevents Apache `DirectorySlash` from changing `/collection` into `/collection/`. For aliases, require exact escaped `RewriteRule` entries with `[R=301,L,NE]`; reject newlines, decoded dot segments, and external targets. Require the final rule to return 404 rather than the root `index.html`.

- [ ] **Step 2: Run generator tests and verify failure**

```powershell
node --test tests/unit/prerender.test.mjs tests/mtw-deployment.test.mjs
```

Expected: FAIL because the generators and static routing contract do not exist.

- [ ] **Step 3: Add stable injection markers to the HTML template**

Keep `lang="ru"`, favicon, theme color, and a useful fallback title. Add unique comments `<!-- ICONAMASTER_SEO -->`, `<!-- ICONAMASTER_ANALYTICS -->`, and `<!-- ICONAMASTER_NOSCRIPT -->`. Keep the root element as:

```html
<div id="root"><!-- ICONAMASTER_APP --></div>
```

- [ ] **Step 4: Implement current Metrica markup**

`renderDocument` inserts an async initialization using `metrikaId`:

```html
<script data-metrika="112185835">
  (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1;
  k.src=r;a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
  ym(112185835,'init',{clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});
</script>
```

Insert one `noscript` image pointing to `https://mc.yandex.ru/watch/112185835`. The generator test must verify the number comes from `siteConfig`, not from legacy source text.

- [ ] **Step 5: Implement deterministic static generation**

`scripts/prerender.mjs` reads every file named by `public/content/manifest.json`, validates the resulting bundle, imports `dist/prerender/entry-server.js`, and writes every route from `listCanonicalPaths`. It also writes the 404 document and the crawl files. Sort alias rules by source path using code-unit ordering. Refuse to write an output path that resolves outside `dist/client`.

Build SSR with a stable entry filename under `dist/prerender`, run the generator, then remove `dist/prerender` after success. Do not delete or rewrite `public/content`.

- [ ] **Step 6: Replace the MTW fallback template**

Use this base contract in `public/.htaccess`:

```apache
DirectoryIndex index.html
ErrorDocument 404 /404.html

RewriteEngine On

# ICONAMASTER_ROUTE_RULES

# ICONAMASTER_ALIAS_RULES

RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]

RewriteRule ^ - [R=404,L]
```

Have the generator replace only `# ICONAMASTER_ROUTE_RULES` and `# ICONAMASTER_ALIAS_RULES` in the built copy. Route rules are generated before the `-d` guard so a clean canonical URL is internally mapped without a directory redirect. Modify `prepareMtwBuild` so it no longer overwrites the generated `dist/client/.htaccess` with the public template; assert the generated file exists instead.

- [ ] **Step 7: Update build scripts**

Add scripts with these responsibilities:

```json
"build:client": "vite build",
"build:ssr": "vite build --ssr src/entry-server.jsx --outDir dist/prerender",
"prerender": "node scripts/prerender.mjs",
"build:static": "npm run build:client && npm run build:ssr && npm run prerender",
"build": "npm run build:static && node scripts/prepare-sites-build.mjs",
"build:mtw": "npm run build:static && node scripts/prepare-mtw-build.mjs"
```

Keep all existing test and migration scripts.

- [ ] **Step 8: Run tests, build, and commit**

```powershell
node --test tests/unit/prerender.test.mjs tests/mtw-deployment.test.mjs
npm run build
npm run test:sites
npm run build:mtw
npm run test:mtw
git add scripts/lib/static-site.mjs scripts/prerender.mjs tests/unit/prerender.test.mjs index.html public/.htaccess scripts/prepare-mtw-build.mjs tests/mtw-deployment.test.mjs vite.config.mjs package.json package-lock.json
git commit -m "feat: generate crawlable static pages"
```

---

### Task 7: Post-build SEO verification gate

**Files:**
- Create: `tests/static-build.test.mjs`
- Modify: `package.json`
- Modify: `scripts/run-verification.mjs`
- Modify: `tests/unit/verification-runner.test.mjs`
- Modify: `tests/unit/document-metadata.test.mjs`

**Interfaces:**
- Consumes: `dist/client` produced by `npm run build`.
- Produces: `npm run test:static` and a full `npm run verify` gate that rejects incomplete SEO output.

- [ ] **Step 1: Write a failing post-build contract**

Load the committed content bundle and `listCanonicalPaths`. For every path, require the generated file to contain:

```js
assert.match(html, /<html\s+lang="ru">/u);
assert.match(html, /<h1\b/u);
assert.match(html, /<meta\s+name="description"/u);
assert.match(html, /<link\s+rel="canonical"/u);
assert.match(html, /property="og:title"/u);
assert.match(html, /type="application\/ld\+json"/u);
assert.match(html, /data-prerender-path=/u);
assert.doesNotMatch(html, /Prototype/u);
assert.doesNotMatch(html, /Загружаем коллекцию/u);
```

Parse every JSON-LD script with `JSON.parse`. Require 73 canonical outputs for the current bundle: 1 home, 1 collection, 50 icons, 8 pages, 1 article index, 10 articles, 1 video, and 1 contacts page. Calculate this expectation from bundle counts as well as asserting the current total, so a later published record updates the generated set intentionally.

Require 73 unique canonical URLs, no aliases in Sitemap, exactly 78 alias redirects for the current alias file, a 404 document with `noindex,follow`, and Metrica ID `112185835` on every canonical page.

- [ ] **Step 2: Run the test against the pre-change build and verify failure**

```powershell
node --test tests/static-build.test.mjs
```

Expected: FAIL because deep HTML routes, crawl files, and metadata are absent.

- [ ] **Step 3: Add the verification command and sequence**

Add:

```json
"test:static": "node --test tests/static-build.test.mjs"
```

Insert `['run', 'test:static']` immediately after `['run', 'build']` in `verificationSteps`. Update the runner test to expect the exact new order and still exactly one portability marker.

- [ ] **Step 4: Strengthen source identity tests**

Require `index.html` to keep `lang="ru"`, the Russian fallback title, and all four static injection markers. Require source and generated HTML to contain no `Prototype`.

- [ ] **Step 5: Run the full gate and commit**

```powershell
npm run verify
git add tests/static-build.test.mjs package.json package-lock.json scripts/run-verification.mjs tests/unit/verification-runner.test.mjs tests/unit/document-metadata.test.mjs
git commit -m "test: gate static SEO release output"
```

Expected: unit, setup, content, asset, static-build, Sites, and MTW tests all pass.

---

### Task 8: Local browser and responsive acceptance

**Files:**
- Create: `reports/seo-static-generation-qa.md`
- Create: `qa-output/seo-home-desktop.png`
- Create: `qa-output/seo-murals-desktop.png`
- Create: `qa-output/seo-murals-mobile.png`
- Create: `qa-output/seo-contacts-mobile.png`

**Interfaces:**
- Consumes: verified `dist/client` and local preview server.
- Produces: visual and interactive evidence for the release; no design changes unless a defect is observed.

- [ ] **Step 1: Start the local preview**

```powershell
npm run build
npm run preview -- --host 127.0.0.1
```

Keep the returned process/session handle. Open the local URL using the available in-app browser skill.

- [ ] **Step 2: Inspect desktop routes**

At 1440 px width, inspect `/`, `/raschistka-hramovyh-rospisey`, `/icons/archangel-michael`, and `/contacts`. Verify no hydration warning, no content flash, one H1, ordinary links, correct address, working map URL, and visible WhatsApp/phone/email.

- [ ] **Step 3: Inspect mobile routes**

At 390 px width, inspect the service page and contacts. Verify no horizontal overflow, 44 px interactive targets, readable headings, correct image containment, menu navigation to the service page, and footer address.

- [ ] **Step 4: Verify browser-side metadata transitions and goals**

Navigate without reload from home to the service page, an icon, and contacts. Read the DOM after each transition and confirm title, canonical, description, Open Graph, and JSON-LD change exactly once. Stub or observe `window.ym` locally and confirm contact clicks emit the expected goal while the destination navigation remains intact.

- [ ] **Step 5: Record results and fix only observed defects**

Write route, viewport, metadata, console, network, and interaction results to `reports/seo-static-generation-qa.md`. If a defect appears, first add a reproducing test, implement the smallest correction, rerun the focused test and `npm run verify`, then repeat the affected browser check.

- [ ] **Step 6: Commit acceptance evidence**

```powershell
git add reports/seo-static-generation-qa.md qa-output/seo-home-desktop.png qa-output/seo-murals-desktop.png qa-output/seo-murals-mobile.png qa-output/seo-contacts-mobile.png
git commit -m "test: record static SEO browser acceptance"
```

---

### Task 9: Source push and MTW production release

**Files:**
- Create: `docs/deployments/2026-09-02-seo-static-generation.md`
- Create locally but do not commit: `.release-artifacts/iconamaster-seo-static-$releaseStamp.tar.gz`, where `$releaseStamp` is calculated in Step 4.
- Create remotely: `/www/vhosts/27769/iconamaster.ru.before-seo-static-$releaseStamp.tar.gz`.
- Create remotely: `/www/vhosts/27769/iconamaster.ru.rollback-before-seo-static-$releaseStamp`.

**Interfaces:**
- Consumes: clean verified branch and existing secure MTW SSH helper files outside Git.
- Produces: published static SEO release with preserved rollback artifacts and a credential-free deployment record.

- [ ] **Step 1: Reconcile with remote main without losing work**

```powershell
git status --short --branch
git fetch origin
git log --oneline --left-right HEAD...origin/main
```

Expected: clean worktree. If `origin/main` has new commits, rebase the feature commits onto it, resolve only task-owned conflicts, then rerun `npm run verify`. Never reset or discard unrelated work.

- [ ] **Step 2: Run final verification and inspect the exact diff**

```powershell
npm run verify
git diff origin/main...HEAD --check
git diff origin/main...HEAD --stat
```

Expected: verification succeeds and the diff contains only the approved SEO, service, address, analytics, QA, and documentation work.

- [ ] **Step 3: Push the exact verified source before deployment**

```powershell
git push origin HEAD:main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: local HEAD equals remote `refs/heads/main`. Stop before MTW if the push or equality check fails.

- [ ] **Step 4: Build and package the post-push MTW release**

```powershell
npm run build:mtw
$releaseStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$artifactDirectory = '.release-artifacts'
New-Item -ItemType Directory -Force -Path $artifactDirectory | Out-Null
$releaseArchive = Join-Path $artifactDirectory "iconamaster-seo-static-$releaseStamp.tar.gz"
tar -czf $releaseArchive -C dist/client .
$releaseHash = (Get-FileHash -Algorithm SHA256 $releaseArchive).Hash.ToLowerInvariant()
```

List the archive and require `index.html`, `.htaccess`, `robots.txt`, `sitemap.xml`, `404.html`, the service page, one icon page, one article page, assets, and content JSON.

- [ ] **Step 5: Create and verify the remote backup**

Resolve the user-owned operational helpers without putting credentials in source control:

```powershell
$operationsRoot = (Resolve-Path '..\..').Path
$askPass = Join-Path $operationsRoot 'tools\mtw-askpass.cmd'
$knownHosts = Join-Path $operationsRoot 'tools\mtw-known-hosts'
$env:SSH_ASKPASS = $askPass
$env:SSH_ASKPASS_REQUIRE = 'force'
$sshCommon = @('-p','1222','-o',"UserKnownHostsFile=$knownHosts",'-o','StrictHostKeyChecking=yes','user27769@epsilon.mtw.ru')
```

Upload the release with `scp` using the same strict host-key file. On MTW, from `/www/vhosts/27769`, create `iconamaster.ru.before-seo-static-$releaseStamp.tar.gz`, list it, and require `index.html`, `corona/admin/index.php`, `config.php`, `uploads`, and `captcha`. Record its SHA-256 without printing credentials.

- [ ] **Step 6: Prepare and validate a sibling candidate**

Create `iconamaster.ru.new-seo-static-$releaseStamp`, extract the uploaded archive there, then copy `corona`, `config.php`, `uploads`, and `captcha` from the active root. Require all of these plus `.htaccess`, `robots.txt`, `sitemap.xml`, `404.html`, and `raschistka-hramovyh-rospisey/index.html` before cutover.

- [ ] **Step 7: Perform atomic cutover with automatic first-rename reversal**

Use one fail-fast remote shell transaction:

```sh
set -eu
cd /www/vhosts/27769
mv iconamaster.ru "iconamaster.ru.rollback-before-seo-static-$releaseStamp"
if mv "iconamaster.ru.new-seo-static-$releaseStamp" iconamaster.ru; then
  exit 0
fi
mv "iconamaster.ru.rollback-before-seo-static-$releaseStamp" iconamaster.ru
exit 1
```

The execution must interpolate the already validated `$releaseStamp` before transmission. Do not delete either directory or archive.

- [ ] **Step 8: Smoke-test production without cache**

Require:

- `/`, `/collection`, `/raschistka-hramovyh-rospisey`, `/icons/archangel-michael`, `/articles/restoration-murals-cleaning`, `/contacts`: HTTP 200, Russian H1, route-specific canonical, JSON-LD, and Metrica 112185835;
- `/robots.txt`: HTTP 200, `text/plain`, Sitemap directive;
- `/sitemap.xml`: HTTP 200, XML content type, 73 current canonical URLs;
- one legacy alias: HTTP 301 to its canonical URL;
- one random unknown path: HTTP 404 with `noindex,follow`;
- `/corona/admin/index.php`: expected login redirect and final HTTP 200;
- representative JS, CSS, icon, article image, and content JSON hashes match the verified release.

If any critical check fails, preserve the failed active directory under a new name and reverse-rename the rollback directory immediately.

- [ ] **Step 9: Record and push deployment evidence**

Write `docs/deployments/2026-09-02-seo-static-generation.md` with release commit, archive names and hashes, rollback directory, route/status evidence, metadata evidence, Metrica ID, and exact reverse-rename rollback instructions. Do not include credentials.

```powershell
git add docs/deployments/2026-09-02-seo-static-generation.md
git commit -m "docs: record static SEO deployment"
git push origin HEAD:main
```

---

### Task 10: Public address consistency check

**Files:**
- Modify if needed: `docs/deployments/2026-09-02-seo-static-generation.md`

**Interfaces:**
- Consumes: published canonical address, `https://yandex.com/maps/-/CTT2bAoq`, and the public 2GIS card.
- Produces: verified public address evidence or an explicit owner-action blocker for an external card.

- [ ] **Step 1: Verify the published site address**

Open production contacts, footer, page source JSON-LD, the excursion page, and restoration page. Require the canonical full address everywhere location data is asserted.

- [ ] **Step 2: Inspect Yandex Maps and 2GIS**

Using the browser skill, open the supplied Yandex short link and the current 2GIS card. Record the displayed organization name, address, and destination URL. Do not rely on search snippets when the live card is available.

- [ ] **Step 3: Correct an accessible owner-managed card**

If the current browser session exposes verified owner controls, change only the address to `Московская область, д. Брёхово, Ромашковая ул., 16`, submit it, and record the resulting confirmation state. Do not change phone, hours, categories, or other business fields.

If owner verification or sign-in is required, stop the external edit and record the exact UI state and required owner action. Do not submit an anonymous public correction in place of owner verification.

- [ ] **Step 4: Update the deployment record**

Record whether both cards already agree, an owner edit was submitted, or owner action remains. If the document changes:

```powershell
git add docs/deployments/2026-09-02-seo-static-generation.md
git commit -m "docs: record public address verification"
git push origin HEAD:main
```

---

## Completion Audit

Before claiming completion, inspect production and mark each result with direct evidence:

1. Root and deep HTML use `lang="ru"` and contain no `Prototype`.
2. All 73 current canonical pages return meaningful HTML without JavaScript.
3. `robots.txt`, `sitemap.xml`, legacy 301, and unknown 404 behave as specified.
4. Each route type has individual title, description, canonical, Open Graph, Twitter, and parseable JSON-LD.
5. Counter 112185835 and all four contact goals are present; legacy counter 17785549 is absent.
6. The commercial mural-cleaning page is linked from header, footer, and related article.
7. Icon categories and availability are unchanged from the input catalog.
8. The canonical Брёхово address appears in contact data, visible production UI, and LocalBusiness JSON-LD.
9. Full verification and responsive browser QA pass.
10. Exact verified source is on GitHub, production matches the release, Corona still works, and rollback artifacts remain available.
11. Live Yandex Maps and 2GIS card states are recorded; any required owner-only external action is stated precisely.
