# Iconamaster Corona Admin Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подключить существующую Corona Admin к новому сайту как безопасный источник структурированного контента, не позволяя изменениям в админке ломать премиальный дизайн.

**Architecture:** Corona продолжает хранить основные записи в MySQL, а новые метаданные и галереи получают отдельные таблицы. PHP-мост проверяет данные, создаёт версионированные JSON-файлы во временном каталоге и атомарно заменяет последнюю корректную версию. React-приложение из первого плана уже потребляет тот же контракт `public/content/*.json`; на Sites используется снимок, а на основном домене — кэш, генерируемый Corona.

**Tech Stack:** Existing Corona PHP/MySQL application, PHP CLI on MTW, MySQL, UTF-8 JSON, React/Vite consumer from Plan 1, Node.js contract tests, SSH port 1222.

**Spec:** `premium-prototype/docs/superpowers/specs/2026-08-27-iconamaster-full-content-migration-design.md`

**Depends on:** `premium-prototype/docs/superpowers/plans/2026-08-27-iconamaster-content-migration.md` through Task 9.

## Global Constraints

- Corona редактирует только данные; CSS, React-компоненты, сетка, типографика и адаптивность недоступны из админки.
- Не выводить, не логировать, не коммитить и не публиковать содержимое `new admid creds.txt`.
- Перед вводом пароля в браузер запросить подтверждение непосредственно перед действием.
- Не передавать производственные учётные данные в Sites или клиентский JavaScript.
- Сохранять полноразмерный оригинал каждого изображения; производные файлы создаются отдельно.
- Все новые таблицы и JSON используют UTF-8/utf8mb4.
- Невалидное сохранение не заменяет последнюю корректную версию JSON-кэша.
- Перед изменением базы или файлов создать проверяемые резервные копии и записать команду отката.
- Не изменять основной сайт до успешного теста на копии данных и техническом адресе.
- Все пути ниже указаны относительно корня Git; приложение находится в `premium-prototype/`.

---

### Task 1: Credential hygiene and read-only server audit

**Files:**
- Modify: `.gitignore`
- Create: `premium-prototype/ops/corona/audit.sh`
- Create: `premium-prototype/ops/corona/README.md`
- Create: `premium-prototype/tests/unit/corona-ops.test.mjs`
- Modify: `premium-prototype/package.json`

**Interfaces:**
- Consumes: SSH access to `iconamaster@iconamaster.ru:1222`; the password remains only in the user-owned credential file.
- Produces: a redacted environment report containing PHP version, MySQL client version, required extensions, document root and writable-state checks without secrets.

- [ ] **Step 1: Ignore the exact credential filename and test the rule**

Append this exact line to the repository-root `.gitignore`:

```gitignore
new admid creds.txt
```

Create the test:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('repository ignores the Corona credential file by exact name', async () => {
  const ignore = await readFile(new URL('../../../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /^new admid creds\.txt$/m);
});
```

- [ ] **Step 2: Run the hygiene test**

Run: `node --test premium-prototype/tests/unit/corona-ops.test.mjs`
Expected: PASS.

Run: `git check-ignore -v -- "<workspace>\new admid creds.txt"`
Expected: output identifies the new exact `.gitignore` rule. The credential file remains outside Git.

- [ ] **Step 3: Create a read-only remote audit**

```bash
#!/usr/bin/env bash
set -euo pipefail
printf 'php='; php -r 'echo PHP_VERSION, PHP_EOL;'
printf 'mysql_client='; mysql --version | sed 's/[[:space:]]\+/ /g'
php -r 'foreach (["json","mysqli","mbstring","fileinfo","gd"] as $e) { echo $e,"=",extension_loaded($e)?"yes":"no",PHP_EOL; }'
printf 'document_root=%s\n' "${DOCUMENT_ROOT:-$(pwd)}"
for path in corona uploads; do
  test -d "$path" && printf '%s_exists=yes\n' "$path" || printf '%s_exists=no\n' "$path"
  test -w "$path" && printf '%s_writable=yes\n' "$path" || printf '%s_writable=no\n' "$path"
done
```

The script must not read `config.php`, environment variables containing passwords, browser storage or the credential file.

- [ ] **Step 4: Run the audit through SSH**

After action-time confirmation if a password must be entered, run:

```powershell
ssh -p 1222 iconamaster@iconamaster.ru 'bash -s' < premium-prototype/ops/corona/audit.sh
```

Record only non-secret results in `premium-prototype/ops/corona/README.md`. The minimum supported environment is PHP 7.4+ with `json`, `mysqli`, `mbstring`, `fileinfo` and either `gd` or `imagick`. If the server is older, stop before deployment and revise compatibility syntax in the plan.

- [ ] **Step 5: Commit audit tooling and the ignore rule**

```bash
git add .gitignore premium-prototype/ops/corona premium-prototype/tests/unit/corona-ops.test.mjs premium-prototype/package.json
git commit -m "chore: secure and audit Corona integration"
```

---

### Task 2: Additive database schema and reversible migration

**Files:**
- Create: `premium-prototype/server/corona-bridge/sql/001_content_bridge_up.sql`
- Create: `premium-prototype/server/corona-bridge/sql/001_content_bridge_down.sql`
- Create: `premium-prototype/tests/unit/corona-schema.test.mjs`
- Modify: `premium-prototype/package.json`

**Interfaces:**
- Consumes: existing `shop` record IDs.
- Produces: `shop_meta`, `shop_images`, `content_aliases`, and `content_export_log` without changing or deleting legacy columns.

- [ ] **Step 1: Write failing schema assertions**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Corona migration is additive, utf8mb4 and reversible', async () => {
  const up = await readFile(new URL('../../server/corona-bridge/sql/001_content_bridge_up.sql', import.meta.url), 'utf8');
  const down = await readFile(new URL('../../server/corona-bridge/sql/001_content_bridge_down.sql', import.meta.url), 'utf8');
  for (const table of ['shop_meta', 'shop_images', 'content_aliases', 'content_export_log']) {
    assert.match(up, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.match(down, new RegExp(`DROP TABLE IF EXISTS ${table}`));
  }
  assert.match(up, /CHARACTER SET utf8mb4/);
  assert.doesNotMatch(up, /DROP\s+(TABLE|COLUMN)/i);
});
```

- [ ] **Step 2: Run the schema test to verify failure**

Run: `node --test premium-prototype/tests/unit/corona-schema.test.mjs`
Expected: FAIL because the SQL files do not exist.

- [ ] **Step 3: Write the additive schema**

`shop_meta` fields: `shop_id` primary key, unique `slug`, `availability`, `size_text`, `period_text`, `technique_text`, `origin_text`, `condition_text`, `expertise_text`, `source_url`, `updated_at`.

`shop_images` fields: auto-increment `id`, indexed `shop_id`, `original_path`, `catalog_path`, `detail_path`, `alt_text`, `width`, `height`, `sort_order`, `is_cover`, `sha256`, `created_at`.

`content_aliases` fields: auto-increment `id`, unique `legacy_path`, `canonical_path`, `updated_at`.

`content_export_log` fields: auto-increment `id`, `version`, `status`, `error_text`, `created_at`.

Use InnoDB and `utf8mb4_unicode_ci`. Foreign keys may be added only after the audit confirms the existing `shop` table is InnoDB and its ID type is compatible; otherwise preserve referential checks in application code.

- [ ] **Step 4: Validate the SQL on a disposable database**

On the server, create a temporary database named `iconamaster_bridge_test`, create a minimal `shop(id INT PRIMARY KEY)`, apply the up migration, inspect tables, apply the down migration and confirm only the original `shop` remains. Do not run the migration against production in this task.

Expected: both scripts exit successfully and the legacy table is unchanged.

- [ ] **Step 5: Commit the reversible migration**

```bash
git add premium-prototype/server/corona-bridge/sql premium-prototype/tests/unit/corona-schema.test.mjs premium-prototype/package.json
git commit -m "feat: add reversible Corona content schema"
```

---

### Task 3: PHP content contract and validators

**Files:**
- Create: `premium-prototype/server/corona-bridge/src/ContentValidator.php`
- Create: `premium-prototype/server/corona-bridge/src/ContentNormalizer.php`
- Create: `premium-prototype/server/corona-bridge/tests/bootstrap.php`
- Create: `premium-prototype/server/corona-bridge/tests/ContentValidatorTest.php`
- Create: `premium-prototype/server/corona-bridge/tests/run.php`

**Interfaces:**
- Consumes: associative arrays produced from Corona rows.
- Produces: `ContentNormalizer::icon(array $shop, ?array $meta, array $images): array` and `ContentValidator::bundle(array $bundle): array` where the return value is a list of validation errors.

- [ ] **Step 1: Write the failing PHP test**

```php
<?php
$icon = ContentNormalizer::icon(
    ['id' => 7, 'name' => 'Пример', 'text' => '<p>Описание</p>', 'price' => '0', 'sorder' => '10', 'active' => '1'],
    ['slug' => 'primer', 'availability' => 'В наличии'],
    [['detail_path' => '/assets/icons/primer.jpg', 'alt_text' => 'Пример, полный вид', 'width' => 1200, 'height' => 1600, 'sort_order' => 1, 'is_cover' => 1]]
);
assert($icon['slug'] === 'primer');
assert($icon['price'] === null);
assert($icon['published'] === true);
assert(count(ContentValidator::bundle([
    'version' => 1, 'icons' => [$icon], 'pages' => [], 'articles' => [], 'videos' => [],
    'contacts' => ['whatsapp' => '79166554595', 'phone' => '+79166554595', 'email' => 'iconamaster@yandex.ru'],
    'aliases' => []
])) === 0);
```

- [ ] **Step 2: Run the PHP test on the audited server to verify failure**

Upload only `server/corona-bridge/tests` to a non-public staging directory and run:

```bash
php server/corona-bridge/tests/run.php
```

Expected: FAIL because the validator and normalizer classes do not exist.

- [ ] **Step 3: Implement normalization matching Plan 1 exactly**

Normalize `price <= 0` to `null`, integer order values, boolean publication, UTF-8 strings and sorted images. Reject missing or duplicate slugs, a published icon without an image, an image without dimensions/alt text, malformed contacts, an unknown video provider, `autoplay !== false`, duplicate aliases and aliases without a root-relative target.

Do not include raw SQL rows, password fields, filesystem roots or session data in returned arrays.

- [ ] **Step 4: Run PHP and JavaScript contract tests**

Run remotely: `php server/corona-bridge/tests/run.php`
Expected: `ContentValidatorTest PASS` and exit code 0.

Save the normalized fixture as `premium-prototype/tests/fixtures/corona/content-bundle.json`, then run locally:

```bash
node --test premium-prototype/tests/unit/content-schema.test.mjs
```

Expected: the JavaScript validator accepts the PHP-produced fixture.

- [ ] **Step 5: Commit the shared contract implementation**

```bash
git add premium-prototype/server/corona-bridge/src premium-prototype/server/corona-bridge/tests premium-prototype/tests/fixtures/corona/content-bundle.json
git commit -m "feat: validate Corona content contract"
```

---

### Task 4: Repository adapter and atomic JSON cache

**Files:**
- Create: `premium-prototype/server/corona-bridge/src/DatabaseFactory.php`
- Create: `premium-prototype/server/corona-bridge/src/ContentRepository.php`
- Create: `premium-prototype/server/corona-bridge/src/JsonCacheWriter.php`
- Create: `premium-prototype/server/corona-bridge/bin/export-content.php`
- Create: `premium-prototype/server/corona-bridge/tests/JsonCacheWriterTest.php`
- Modify: `premium-prototype/server/corona-bridge/tests/run.php`

**Interfaces:**
- Consumes: the existing Corona database configuration server-side and the four additive tables.
- Produces: `JsonCacheWriter::publish(string $directory, array $bundle): string`, returning the content version written to `manifest.json`.

- [ ] **Step 1: Write failing atomic-write tests**

```php
<?php
$dir = sys_get_temp_dir().'/iconamaster-cache-'.bin2hex(random_bytes(4));
mkdir($dir, 0700, true);
$writer = new JsonCacheWriter(new ContentValidator());
$version = $writer->publish($dir, valid_bundle());
assert(is_file($dir.'/manifest.json'));
assert(json_decode(file_get_contents($dir.'/icons.json'), true)[0]['slug'] === 'primer');
$before = file_get_contents($dir.'/manifest.json');
try { $writer->publish($dir, invalid_bundle()); assert(false); } catch (InvalidArgumentException $e) {}
assert(file_get_contents($dir.'/manifest.json') === $before);
```

- [ ] **Step 2: Run the cache test to verify failure**

Run remotely: `php server/corona-bridge/tests/run.php`
Expected: FAIL because `JsonCacheWriter` does not exist.

- [ ] **Step 3: Implement prepared reads and atomic publishing**

`DatabaseFactory` creates a `mysqli` connection using the server-side Corona configuration, enables strict error reporting, sets `utf8mb4`, and never serializes credentials. `ContentRepository` uses prepared statements for filtered reads and deterministic ordering.

`JsonCacheWriter` writes each JSON document to a unique sibling temporary file with `LOCK_EX`, validates decoded output, renames data files first and `manifest.json` last, and removes temporary files on failure. JSON flags: `JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR`.

- [ ] **Step 4: Test export against a disposable database fixture**

Populate the disposable database with one active icon, one inactive icon, two images, one article and one alias. Run:

```bash
php server/corona-bridge/bin/export-content.php --output=/tmp/iconamaster-content-test
php server/corona-bridge/tests/run.php
```

Expected: the manifest is written last, only valid published records are visible to frontend selectors, and the inactive record remains in source data with `published: false`.

- [ ] **Step 5: Commit the exporter**

```bash
git add premium-prototype/server/corona-bridge/src premium-prototype/server/corona-bridge/bin premium-prototype/server/corona-bridge/tests
git commit -m "feat: export Corona content atomically"
```

---

### Task 5: Original-preserving image pipeline

**Files:**
- Create: `premium-prototype/server/corona-bridge/src/ImageUploadService.php`
- Create: `premium-prototype/server/corona-bridge/tests/ImageUploadServiceTest.php`
- Modify: `premium-prototype/server/corona-bridge/tests/run.php`

**Interfaces:**
- Consumes: one validated PHP upload entry and an icon ID.
- Produces: `{ original_path, catalog_path, detail_path, width, height, sha256 }`; the original bytes are retained unchanged.

- [ ] **Step 1: Write failing image-preservation tests**

```php
<?php
$source = fixture_upload('valid-icon.jpg');
$before = hash_file('sha256', $source['tmp_name']);
$result = $service->store($source, 7);
assert(hash_file('sha256', $result['absolute_original_path']) === $before);
assert($result['width'] > 0 && $result['height'] > 0);
assert(is_file($result['absolute_catalog_path']));
assert(is_file($result['absolute_detail_path']));
```

Add negative tests for a PHP file renamed to `.jpg`, a file above the configured byte limit and a corrupt image.

- [ ] **Step 2: Run the image tests to verify failure**

Run remotely: `php server/corona-bridge/tests/run.php`
Expected: FAIL because `ImageUploadService` does not exist.

- [ ] **Step 3: Implement MIME validation and derivatives**

Use `finfo_file` plus `getimagesize`; allow only `image/jpeg`, `image/png` and `image/webp`. Generate a catalog derivative no wider than 720 px and a detail derivative no wider than 1600 px without upscaling. Preserve aspect ratio, strip no semantic pixels, and never overwrite the original. Store files outside executable PHP paths or deny script execution in the upload directory.

- [ ] **Step 4: Verify checksum, dimensions and failure cleanup**

Run remotely: `php server/corona-bridge/tests/run.php`
Expected: PASS; invalid uploads leave no files or database rows.

- [ ] **Step 5: Commit the image pipeline**

```bash
git add premium-prototype/server/corona-bridge/src/ImageUploadService.php premium-prototype/server/corona-bridge/tests
git commit -m "feat: preserve Corona image originals"
```

---

### Task 6: Extended icon editor and export hooks

**Files:**
- Create: `premium-prototype/server/corona-bridge/admin/icon-content.php`
- Create: `premium-prototype/server/corona-bridge/admin/icon-content-save.php`
- Create: `premium-prototype/server/corona-bridge/admin/icon-image-delete.php`
- Create: `premium-prototype/server/corona-bridge/src/AdminGuard.php`
- Create: `premium-prototype/server/corona-bridge/src/Csrf.php`
- Create: `premium-prototype/server/corona-bridge/tests/AdminSecurityTest.php`
- Modify during deployment: `corona/admin/includes/shop_list.php`
- Modify during deployment: `corona/admin/includes/shop_save.php`

**Interfaces:**
- Consumes: authenticated Corona session, icon ID and validated form fields.
- Produces: updated legacy `shop`, `shop_meta`, `shop_images`, aliases and a refreshed JSON cache.

- [ ] **Step 1: Write failing guard and CSRF tests**

```php
<?php
assert(AdminGuard::isAuthenticated([]) === false);
$session = ['member_id' => 1, 'is_admin' => true, 'csrf' => 'known-token'];
assert(AdminGuard::isAuthenticated($session) === true);
assert(Csrf::verify($session, 'known-token') === true);
assert(Csrf::verify($session, 'wrong-token') === false);
```

- [ ] **Step 2: Run the security tests to verify failure**

Run remotely: `php server/corona-bridge/tests/run.php`
Expected: FAIL because `AdminGuard` and `Csrf` do not exist.

- [ ] **Step 3: Build the data-only editor**

The editor exposes name, published state, availability, price, order, slug, size, period, technique, origin, condition, expertise, description, source URL and gallery rows. It contains no fields for CSS classes, inline style, template names, HTML scripts or layout positions.

Use prepared statements, POST for writes, CSRF tokens, server-side length limits and an explicit delete confirmation for gallery images. After a successful transaction, call the exporter. If export fails, roll back the database transaction and keep the old cache.

- [ ] **Step 4: Add minimal hooks to the existing Corona shop list**

Add one “Контент нового сайта” link per shop row to the sidecar editor. Keep the original list and authentication flow. Replace direct raw save concatenation for the fields touched by the new editor; do not rewrite unrelated Corona modules.

- [ ] **Step 5: Test one full icon update on staging**

Using a copy of a real icon, change its price, availability, description and image order. Confirm the database, exported `icons.json` and staging frontend update together. Confirm the DOM contains no admin-supplied `<style>`, `<script>` or event-handler attributes.

- [ ] **Step 6: Commit the icon editor**

```bash
git add premium-prototype/server/corona-bridge/admin premium-prototype/server/corona-bridge/src premium-prototype/server/corona-bridge/tests
git commit -m "feat: manage premium icon content in Corona"
```

---

### Task 7: Articles, pages, contacts and cache regeneration

**Files:**
- Create: `premium-prototype/server/corona-bridge/src/RichTextSanitizer.php`
- Create: `premium-prototype/server/corona-bridge/admin/site-settings.php`
- Create: `premium-prototype/server/corona-bridge/admin/site-settings-save.php`
- Create: `premium-prototype/server/corona-bridge/tests/RichTextSanitizerTest.php`
- Modify: `premium-prototype/server/corona-bridge/src/ContentRepository.php`
- Modify: `premium-prototype/server/corona-bridge/bin/export-content.php`
- Modify during deployment: Corona article and section save handlers used by the current admin.

**Interfaces:**
- Consumes: published Corona articles/sections and the site-settings form.
- Produces: sanitized `articles.json`, `pages.json`, `videos.json` and `contacts.json` using the same manifest version as `icons.json`.

- [ ] **Step 1: Write a failing sanitizer test**

```php
<?php
$input = '<p onclick="steal()">Текст <strong>иконы</strong></p><script>alert(1)</script><style>body{display:none}</style>';
$clean = RichTextSanitizer::clean($input);
assert($clean === '<p>Текст <strong>иконы</strong></p>');
```

Allow only `p`, `br`, `strong`, `em`, `ul`, `ol`, `li`, `blockquote`, `h2`, `h3` and safe `a[href]`. Remove style, script, iframe, event handlers and unknown attributes.

- [ ] **Step 2: Run the sanitizer test to verify failure**

Run remotely: `php server/corona-bridge/tests/run.php`
Expected: FAIL because the sanitizer does not exist.

- [ ] **Step 3: Implement editorial and settings export**

Map published `articles` by their stable `CODE`, sections by their explicit canonical mapping, and settings to exactly these contact values: WhatsApp digits, E.164 phone and email. Video settings accept only `youtube` or `vimeo`, an ID and `autoplay=false`.

- [ ] **Step 4: Hook successful saves to one cache refresh**

Article, section and site-settings writes call the same export command after a successful transaction. Multiple JSON documents share one manifest version. A failure writes `status=failed` to `content_export_log` without replacing `manifest.json`.

- [ ] **Step 5: Run end-to-end editorial tests on staging**

Change one article title, one restoration paragraph and the contact email in staging. Confirm the corresponding JSON values and page output change, while typography, spacing, navigation and mobile layout remain identical.

- [ ] **Step 6: Commit editorial integration**

```bash
git add premium-prototype/server/corona-bridge
git commit -m "feat: export Corona editorial content safely"
```

---

### Task 8: Backup, staged deployment, rollback and acceptance

**Files:**
- Create: `premium-prototype/ops/corona/deploy.sh`
- Create: `premium-prototype/ops/corona/rollback.sh`
- Create: `premium-prototype/ops/corona/acceptance.md`
- Modify: `premium-prototype/ops/corona/README.md`
- Modify: `premium-prototype/reports/content-qa.md`

**Interfaces:**
- Consumes: verified frontend build, verified bridge package and MTW access.
- Produces: a staging deployment, backup artifact manifest, tested rollback and finally an enabled same-origin content cache on the main domain.

- [ ] **Step 1: Create deployment scripts with immutable releases**

`deploy.sh` accepts a release archive path, creates `releases/YYYYMMDD-HHMMSS`, verifies checksums, runs PHP syntax/tests, applies the additive migration, exports content to a release-local cache and changes a `current` symlink only after every check succeeds.

`rollback.sh` accepts an existing release name, verifies it exists, switches `current` atomically and restores its manifest without deleting newer releases.

- [ ] **Step 2: Create and verify backups before the first mutation**

On MTW, create a timestamped backup directory outside the public document root. Save:

- an archive of `corona/`, `uploads/` and the current site entry files;
- a SQL dump of `shop`, `articles`, `sections`, photo/album tables and the four bridge tables if present;
- SHA-256 checksums and server/PHP versions.

Download the manifest and verify every listed artifact exists and has a non-zero size. Do not proceed if the database dump cannot be restored into the disposable test database.

- [ ] **Step 3: Deploy to the technical/staging address**

Upload the release, run remote PHP tests, apply the schema migration to staging data and generate the initial cache. Point only the technical address at the new frontend and bridge. Keep the main domain unchanged.

- [ ] **Step 4: Test Corona through the real login flow**

Open `https://iconamaster.ru/corona/admin/index.php`. Immediately before entering the password from `new admid creds.txt`, request action-time confirmation. Do not paste credentials into logs, chat, source files or command history.

On staging data, perform:

1. edit price and availability;
2. add and reorder two gallery images;
3. edit one article paragraph;
4. introduce one rejected unsafe HTML sample;
5. simulate an invalid image upload;
6. verify the last correct public cache remains available after both rejected writes.

- [ ] **Step 5: Run frontend and responsive acceptance**

Run `npm run verify`, then inspect the staging frontend at desktop, tablet, 390 px and 360 px. Confirm content changes appear without changed styles, no empty image spaces exist, original images open fully, videos do not autoplay and navigation remains root-relative.

- [ ] **Step 6: Prove rollback before enabling production**

Deploy a second harmless staging release, run `rollback.sh` to the first release and confirm the prior manifest, content version and frontend assets return. Record commands, release IDs and results in `acceptance.md` without credentials.

- [ ] **Step 7: Enable the bridge on the main domain with a short observation window**

After user approval, publish the verified release and run one read-only smoke test plus one reversible content update. Monitor HTTP errors, PHP logs and `content_export_log`. If any published route, cache write or admin save fails, run the tested rollback immediately.

- [ ] **Step 8: Commit the operations evidence**

```bash
git add premium-prototype/ops/corona premium-prototype/reports/content-qa.md
git commit -m "docs: verify Corona integration rollout"
```

---

## Completion checkpoint

Plan 2 is complete only when Corona can update a staging icon, article and contact value; the new site reflects the data through validated JSON; the premium design does not change; rejected content leaves the previous cache intact; original images remain available; and backup plus rollback have both been proven before production enablement.
