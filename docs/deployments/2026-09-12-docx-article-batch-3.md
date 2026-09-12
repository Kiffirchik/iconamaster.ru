# DOCX article batch 3 deployment — 2026-09-12

## Release

- Source commit: `ec35300648d08207b05fcacca64a5850c5929ec1` (short: `ec35300`).
- Source branch: `codex/docx-articles-batch-3-20260912`.
- Release id: `docx3-20260912-articles`.
- Published articles: 18 total; three new articles with 68 unique source images and 71 image placements.
- Production `content/articles.json` SHA-256: `013aaea0ef369764912dcc2c1a374f5c813c6e7dcc68501b3fe3211f97eb9915`.

New canonical routes:

- `/articles/moscow-icon-painting-school`
- `/articles/authentic-hallmarks-precious-metals`
- `/articles/history-assay-hallmarks`

## Safety and rollback artifacts

All paths are relative to `/www/vhosts/27769` on MTW.

- Previous document root: `iconamaster.ru.rollback-before-docx3-20260912-articles`.
- Full pre-release archive: `iconamaster.ru.before-docx3-20260912-articles.tar.gz`.
- Full archive SHA-256: `913934c2ee1b09e0bb1fc5f9f2580916bb1c5a72ec1c86a4d9cc3dacc8a40d96`.
- Uploaded minimal release archive: `iconamaster-docx3-20260912-articles.tar.gz`.
- Release archive SHA-256: `7487556ae7bdeabc907b3511946b26c446a8b325b3fbbc70c7cc67db8cf458a4`.

The live article baseline was checked immediately before cutover. The existing `corona`, `config.php`, `uploads`, `captcha`, `.editor-state`, and all six unaffected content JSON files were preserved. Production catalog edits remained byte-identical across the cutover. No rollback artifact was deleted.

## Verification

- `npm run verify`: passed.
- Windows setup tests: 34/34 passed.
- Unit tests: 212/212 passed.
- Content integrity: 95 icons, 8 pages, 18 articles, 2 videos, 124 aliases, 445 owned assets.
- Static build: 127 canonical pages; 6/6 tests passed.
- Sites package tests: 6/6 passed.
- MTW package tests: 4/4 passed; 312 approved derivatives and 116 live content pages.
- All three new production article routes and `/articles` returned HTTP 200.
- All 68 new production asset files matched the committed SHA-256 values.
- Production sitemap contains 127 canonical URLs.
- `/corona/admin/index.php` redirected to the existing login page and returned HTTP 200.
- `/.editor-state/` returned HTTP 403.
- Desktop production browser inspection showed the approved title, navigation, article layout, and no horizontal overflow or broken visible images. Responsive layout and all image placements were checked against the same verified build before publication.

## Exact rollback

Only roll back after preserving any content edits made in Corona after this release. From `/www/vhosts/27769`, keep the current release under a new failure-preservation name and restore the saved document root:

```sh
set -eu
test -d iconamaster.ru
test -d iconamaster.ru.rollback-before-docx3-20260912-articles
test ! -e iconamaster.ru.failed-docx3-20260912-articles
mv iconamaster.ru iconamaster.ru.failed-docx3-20260912-articles
if ! mv iconamaster.ru.rollback-before-docx3-20260912-articles iconamaster.ru; then
  mv iconamaster.ru.failed-docx3-20260912-articles iconamaster.ru
  exit 1
fi
```

After rollback, verify `/`, `/articles`, `/collection`, one icon page, and `/corona/admin/index.php`. Do not recursively delete the failed release, rollback directory, or archives.
