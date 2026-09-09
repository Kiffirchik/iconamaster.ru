# DOCX Article Batch 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three reviewed DOCX articles and their seventeen immutable original images to the site, then release them to `iconamaster.ru` without losing Corona edits or rollback capability.

**Architecture:** A new one-shot batch importer reads a downloaded twelve-article production baseline, parses paragraphs and DrawingML/VML images in document order, writes additive article records and immutable assets, and appends durable provenance to the existing DOCX report. Existing validators remain fail-closed and receive only three exact new source-reference pairs; the normal static and MTW builders create the public and live-editor routes.

**Tech Stack:** Python 3 with `lxml` and Pillow for DOCX extraction, Node.js 20/npm 10, React 19, Vite 6, Node test runner, PHP 5.2-compatible live pages, Git, SSH/SFTP on Windows.

**Spec:** `docs/superpowers/specs/2026-09-09-docx-article-batch-2-design.md`

## Global Constraints

- Work in the existing linked worktree on branch `codex/iconamaster-production-release`; do not stage the unrelated `tmp/` directory.
- Preserve all twelve current articles byte-for-byte as JSON objects and add exactly three new records in the approved order.
- Preserve every embedded image byte-for-byte; never use ImageGen or pixel editing.
- Remove only the exact suffix ` elib.rshu.ru +1` from the Ветка text.
- Keep hosting `content/*.json` authoritative immediately before import and deployment.
- Commit and push the exact verified source to GitHub before publishing to MTW.
- Make a unique production backup and preserve Corona credentials, configuration, uploads, CAPTCHA data, and `.editor-state`.

---

### Task 1: Add and verify the second DOCX import batch

**Files:**
- Create: `scripts/import-docx-articles-september-2.py`
- Modify: `tests/unit/docx-articles.test.mjs`
- Modify: `tests/unit/editorial-migration.test.mjs`
- Modify: `tests/unit/mural-service.test.mjs`
- Modify: `tests/static-build.test.mjs`
- Modify: `scripts/verify-content.mjs`
- Modify: `public/content/articles.json`
- Modify: `reports/docx-import.json`
- Modify: `reports/editorial-migration.json`
- Create: `public/assets/articles/docx/vetka-icon-painting-1.*` through `-7.*`
- Create: `public/assets/articles/docx/palekh-icon-painting-1.*` through `-7.*`
- Create: `public/assets/articles/docx/peshekhonov-icon-painting-1.*` through `-3.*`

**Interfaces:**
- Consumes: `--incoming <directory>` and `--baseline <downloaded-live-articles.json>`; the baseline must contain exactly the twelve known current article objects.
- Produces: fifteen articles, seventeen new immutable image files, three new document entries and asset entries in `reports/docx-import.json`, and an updated articles checksum in `reports/editorial-migration.json`.

- [ ] **Step 1: Write the failing article and provenance contract**

Extend the DOCX test with the exact expected records:

```js
const newDocxArticles = new Map([
  ['vetka-icon-painting', { sourceUrl: 'docx:vetka-icon-painting.docx', images: 7 }],
  ['palekh-icon-painting', { sourceUrl: 'docx:palekh-icon-painting.docx', images: 7 }],
  ['peshekhonov-icon-painting', { sourceUrl: 'docx:peshekhonov-icon-painting.docx', images: 3 }],
]);
```

Assert that each slug occurs once, is published, has its exact source reference, preserves the expected image count with unique local sources, contains the reviewed opening and closing text, and that `JSON.stringify(article)` excludes `elib.rshu.ru +1`. Assert `verifyProject(...).summary.articles === 15`, update the mural regression count to fifteen, and update the static route/sitemap contract from 120 to 123.

- [ ] **Step 2: Run the focused tests and confirm the red state**

Run:

```powershell
node --test --test-concurrency=1 tests/unit/docx-articles.test.mjs tests/unit/editorial-migration.test.mjs tests/unit/mural-service.test.mjs
```

Expected: failure because the three new article slugs, their assets, and the 15-article contract do not exist yet.

- [ ] **Step 3: Implement the additive one-shot importer**

Create a separate importer with these reviewed job definitions:

```python
jobs = [
    ('Ветковская школа иконописи..docx', 'vetka-icon-painting', 'Иконописная традиция Ветки', 49, 7, {4, 7, 11, 16, 21, 27, 33, 42, 48}),
    ('Иконописные традиции села Палех.docx', 'palekh-icon-painting', 'Иконописные традиции села Палех', 38, 7, {28}),
    ('Пешехоновская икона. Византийский стиль.docx', 'peshekhonov-icon-painting', 'Пешехоновская икона. Византийский стиль', 36, 3, {3, 18}),
]
```

Parse all descendant body paragraphs so table content remains ordered. Reject tracked changes, rotations, unsafe relationship targets, unexpected counts, duplicate destination slugs, a baseline other than the exact twelve current slugs, and attempts to overwrite different bytes. Skip the title indices `{1}`, `{1}`, and `{2}` respectively; clean only ` elib.rshu.ru +1`; represent images as image/gallery blocks of at most three items; retain captions as text; and assert that every accepted source paragraph is represented in the resulting sections.

Use these summaries:

```python
summaries = {
    'vetka-icon-painting': 'История Ветки и особенности её старообрядческой иконописной школы: колорит, орнамент, техника и характерные образы.',
    'palekh-icon-painting': 'История иконописного промысла Палеха, его ведущие мастерские, художественная манера и технико-технологические особенности.',
    'peshekhonov-icon-painting': 'Династия Пешехоновых и новый «византийский стиль» русской иконописи XIX века: мастера, заказы, техника и наследие.',
}
```

- [ ] **Step 4: Run the importer against a production-derived baseline**

Download production `content/articles.json` to an ignored release-artifact path, verify that it contains the exact twelve expected baseline slugs, then run:

```powershell
python scripts/import-docx-articles-september-2.py --incoming ..\..\incoming --baseline .release-artifacts\articles-live-before-docx2.json
```

Expected JSON result: `{"articles":15,"newArticles":3,"newImages":17}`. Confirm that the twelve baseline article objects are deeply equal before and after import.

- [ ] **Step 5: Extend only the exact source allowlist and ownership contract**

Add the three slug/reference pairs to the existing approved DOCX map in `scripts/verify-content.mjs` and `tests/unit/editorial-migration.test.mjs`. Keep service pages forbidden from using DOCX references. Because the importer appends each new asset to `reports/docx-import.json`, retain the existing disk-bijection verifier without adding a second ownership source.

- [ ] **Step 6: Run focused and complete verification**

Run the focused test command again and require all tests to pass. Then run:

```powershell
npm run verify
```

Expected: all unit, integrity, asset, static, Sites-packaging, and MTW-packaging tests pass; the static build emits 123 canonical pages; the MTW build includes all fifteen article records and their live routes.

- [ ] **Step 7: Commit the implementation task**

Stage only the files listed in this task, excluding `tmp/` and `.release-artifacts/`, and commit:

```powershell
git commit -m "feat: add Vetka Palekh and Peshekhonov articles"
```

### Task 2: Review, release, and verify production

**Files:**
- Create: `docs/deployments/2026-09-09-docx-article-batch-2.md`

**Interfaces:**
- Consumes: the verified Task 1 commit and `dist/mtw` output.
- Produces: a GitHub commit matching deployed source, a recoverable MTW backup, and three verified production article routes.

- [ ] **Step 1: Perform task-scoped and whole-branch reviews**

Generate review packages from the Task 1 base through its head. Require spec compliance and code-quality approval, fix any Important/Critical findings with covering tests, and perform one broad final review before release.

- [ ] **Step 2: Run responsive browser QA locally**

Serve the MTW build locally and inspect `/articles`, all three new article routes, and representative existing routes at desktop and 390px mobile widths. Confirm titles, section order, all seventeen images, no empty media slots, no horizontal overflow, no autoplay, and same-tab internal navigation.

- [ ] **Step 3: Push the verified source to GitHub**

Run:

```powershell
git push origin codex/iconamaster-production-release
```

Confirm the remote branch resolves to the exact verified implementation commit before touching production.

- [ ] **Step 4: Recheck live content and create rollback assets**

Immediately before cutover, download hosting `content/*.json` and `.editor-state`, compare the live twelve-article baseline with the imported baseline, and stop if it changed. Create `/www/vhosts/27769/iconamaster.ru.before-docx2-20260909.tar.gz` and `/www/vhosts/27769/iconamaster.ru.rollback-before-docx2-20260909`, verifying both exist before replacement.

- [ ] **Step 5: Stage and cut over the MTW build**

Upload `dist/mtw` to a unique staging directory. Validate required files and PHP 5.2 syntax there. Replace the public application files while preserving Corona credentials/configuration, uploads, CAPTCHA data, and `.editor-state`.

- [ ] **Step 6: Verify production and document the release**

Require HTTP 200 and correct titles for:

```text
https://iconamaster.ru/articles/vetka-icon-painting
https://iconamaster.ru/articles/palekh-icon-painting
https://iconamaster.ru/articles/peshekhonov-icon-painting
```

Verify all seventeen production asset SHA-256 values, fifteen article records, 123 sitemap URLs, representative old routes, anonymous Corona login redirect, and 403 responses for private state/template paths. Record commit hashes, backup paths, route counts, checks, and rollback commands in `docs/deployments/2026-09-09-docx-article-batch-2.md`, commit the deployment record, and push it.
