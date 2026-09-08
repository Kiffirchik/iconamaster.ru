# Catalog filters release — 2026-09-08

Published to MTW at https://iconamaster.ru/collection. No Sites publication.

- Source commit: `7a3df7d967c318a8dc697f985358542f7469e2f3`, confirmed on GitHub main before uploading.
- Exactly two controls: **Период → Назначение**. Availability remains card content, not a filter.
- Combined filtering and reset preserved; missing metadata remains unclassified.
- Two filter fields on desktop/tablet, stacked below 760px.
- Built from a clean archive of `52de898` plus only the four reviewed filter/test/CSS changes. Concurrent live-editor changes in the working tree, including an unrelated CSS hunk, were explicitly excluded and preserved.

## Verification

- TDD: strengthened UI test failed on the old three-control implementation, then passed.
- 196 unit tests, 6 static-build tests, 4 MTW deployment tests passed.
- 118 canonical static pages and 312 approved image derivatives prepared.
- Independent read-only review found no defects.
- Local browser: XIX century returns 9 cards including sold content; combined nonmatching choices show the empty state; reset returns all 95.
- Mobile 390 × 844: fields stack without overlap or horizontal overflow; temporary viewport reset.
- Production: 109 HTTPS checks passed, including all 95 card routes, catalog/home/contact/article HTML, aliases, CSS/JS, images/content, and Corona login.
- Production browser after client initialization: purpose Храмовая returns 2 cards; combined XIX век returns the empty state; reset restores 95 cards with 4 sold annotations.
- One initial automated selection happened before asynchronous content loading/client hydration finished. It was overwritten during initialization; retry after page completion passed. The existing asynchronous bootstrap was not changed in this release.

## Artifacts and preservation

Paths relative to `/www/vhosts/27769`, outside the web root:

| Artifact | Path | SHA-256 | Bytes |
|---|---|---|---:|
| Release | `iconamaster-filters-20260908.tar.gz` | `4fcd57bb24b99e6488d99364f70e8864745bfc3b1efece7a5c150c9b24873630` | 108138130 |
| Backup | `iconamaster.ru.before-filters-20260908.tar.gz` | `7ef8b60cf76d1543ac482405a4b2e7ed3a60b0d491fdc14bef65dad7a3ecc0e3` | 162961576 |

Rollback directory: `iconamaster.ru.rollback-before-filters-20260908`.

All seven content JSON files were unchanged. Home/catalog/content baseline hashes were checked before staging and again before cutover. Backup/archive hashes were verified remotely. The staging root preserved `corona`, `config.php`, `uploads`, and `captcha`; Corona/config/content comparisons passed. Old backups were not deleted.

## Rollback

Only when rollback is requested; reconcile any subsequent CMS edits first.

```sh
set -eu
cd /www/vhosts/27769
test -d iconamaster.ru
test ! -L iconamaster.ru
test -d iconamaster.ru.rollback-before-filters-20260908
test ! -e iconamaster.ru.failed-after-filters-20260908
mv iconamaster.ru iconamaster.ru.failed-after-filters-20260908
if mv iconamaster.ru.rollback-before-filters-20260908 iconamaster.ru; then
  exit 0
fi
mv iconamaster.ru.failed-after-filters-20260908 iconamaster.ru
exit 1
```

Recheck home, collection, an icon card and Corona login after rollback.
