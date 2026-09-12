# Production: three new icons, 2026-09-12

Published on MTW after verified source commit `a17446388a75418f6024111f342bb5e93054ed02` was pushed to `origin/codex/three-new-icons-20260912`.

## Result

- https://iconamaster.ru/icons/angel-khranitel-kiot — 6 photos.
- https://iconamaster.ru/icons/gospod-vsederzhitel-kiot — 5 photos.
- https://iconamaster.ru/icons/panteleimon-tselitel-kiot — 3 photos.
- 98 published icons total. Existing 95 records preserved field-for-field and in their relative order.
- Supplied description and moreDetails text retained; old price 60000, independent discount 50 and new price 29000.
- No image manipulation; all 14 production image SHA-256 hashes equal the supplied originals.

## Verification evidence

- Windows setup: 34/34; unit suite: 218/218.
- Content integrity: 98 icons, 18 articles, 459 owned local assets.
- Original asset gate: 158 originals, 124940257 bytes.
- Static tests: 6/6, Sites packaging compatibility tests: 6/6 (not published to Sites).
- Final `build:mtw`: 130 canonical static pages, 119 live content routes, 312 existing approved derivatives.
- MTW packaging: 4/4.
- Initial full runner found outdated Cargo-only provenance and fixture assumptions; tests were corrected and unit suite rerun. Static route count assertions were then updated 127→130 and the remaining build/packaging stages rerun successfully.
- PHP 5.2 private test: append, exact old-record preservation, duplicate rejection without writes. This is a migration-data test, not an image decoder/template test.
- Independent review: no critical data-loss defects; sidecar hash-check issue fixed and re-reviewed.
- Local browser: gallery/description, details disclosure, discount filter and 390 px layout verified. Post-deploy browser connection timed out; production verification below used real HTTP responses, not browser rendering claims.
- `node scripts/verify-new-icons-live.mjs .release-artifacts/icons-before-new3.json` passed against production: exact new JSON, old-record deep equality, card HTML, 14 photo hashes, collection links, sitemap.
- All other live content JSON hashes unchanged (articles, aliases, contacts, manifest, pages, videos). Corona login/config preserved by deployment comparisons.

## Deployment and rollback

Release: `new-icons-20260912`.

Full previous root:
`/www/vhosts/27769/iconamaster.ru.rollback-before-new-icons-20260912`

Full archive:
`/www/vhosts/27769/iconamaster.ru.before-new-icons-20260912.tar.gz`

Archive SHA-256:
`c1695f3b3bf90e3501430d3da66ad85e8b1fbdd9ae8abe4af806ac227820fb0e`

Public-only payload (4,619,665 bytes; code/templates +14 new photos):
`/www/vhosts/27769/iconamaster-new-icons-20260912.tar.gz`

Payload SHA-256:
`ab0351939bbf2df735f19bb29ddb234b196e80383346519af644e7f10d44ec83`

Migration PHP SHA-256:
`1157d04b4c6f084b8efa04da64dd12916fac8219a1026756fbd256504de1c460`

Additions JSON SHA-256:
`c7c2d43d5487e6ca4a584dac645be9228144d2e22e192f61ab5b55c8f2038a24`

Live icons JSON before:
`977240d37cc8c7e466546e98670cbd41c427db7b428034800de96de8381f91bb`

Live icons JSON after:
`6bb0fdaae0a1505caddd5156625342984283f34a113a1762b257a991aebd306e`

Rollback is a deliberate directory switch back to the preserved root. Before rollback, take a fresh copy of current live content/.editor-state so any later Corona edits are not lost. Do not blindly restore old JSON over newer editorial changes.
