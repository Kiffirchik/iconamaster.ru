# Icon discounts deployment — 2026-09-12

- Source: `3f66568e2a5996fb693e07825782e4eb5fee4fc8`, pushed to `origin/codex/icon-discounts-20260912` before publication.
- Production: https://iconamaster.ru, existing MTW/Corona authentication retained.
- Payload: `iconamaster-discounts-20260912.tar.gz`, SHA-256 `d2b882e33dc0314d4876ce9ea3b06af6461853c1140cacabc0d76acf58918c70`.
- Previous document root: `/www/vhosts/27769/iconamaster.ru.rollback-before-discounts-20260912`.
- Full archive: `/www/vhosts/27769/iconamaster.ru.before-discounts-20260912.tar.gz`, SHA-256 `666a1384e514655da642c0e876205af8ffd883eb797d404c13343a6c2795a94c`.

## Data preservation

The deployment locked the live editor, archived/copied the existing document root, overlaid application code/templates, restored authoritative live JSON and added only missing `discount`/`newPrice` keys. All 95 icons received nullable defaults (190 added fields). No real discount, price, description, original image or Corona credential was changed. Other content JSON was byte-compared with the live source. The `.editor-state` directory and shared lock were retained.

- Icons before migration: `de521880787da74d5da9f9a28fcc4333a133a36f058969076d924c97d05e7ad2`.
- Icons after migration: `e591c88fdc478d3b93a18b389f07ff083e5c978f36f960ed4c672939a25e558f`.

## Verification

- Full `npm run verify`: 34 Windows setup tests, 216 unit tests, content/original-asset checks, 6 static-build tests, 6 legacy Sites compatibility tests, 4 MTW tests; exit 0. Nothing was published to Sites.
- 95 icons, 18 articles, 8 pages, 2 videos; 144 immutable original icon assets verified.
- PHP 5.2.17 tests: valid discounted save; null/0 removal; numeric validation; rejection of missing/equal/higher price; unchanged image references; no-op byte preservation; Unicode thousands separators; discounted public HTML/SEO.
- PHP/React main-markup parity on all 116 live routes. General editor regression tests passed, including stale revisions, backups and article preservation.
- Loopback HTTP integration: anonymous access blocked, authenticated access, CSRF protection, save and immediate discounted response, restoration of private fixtures.
- Browser: desktop and 390px mobile layouts, combined filter and reset, discounted card/detail in local-only fixture. No test discount reached production.
- Production HTTP smoke: homepage, collection, icon detail and articles returned 200 with working application bundles; new filter present; all 95 records have new fields; private paths denied; anonymous editor still redirects to Corona login.
- Authenticated production editor visibly contains both new fields. An unchanged form save succeeded; the icon JSON checksum remained unchanged.

## Rollback

The previous root and full archive above are retained. Before rollback, preserve current `content/*.json` and `.editor-state` so post-release edits are not lost; keep the current root under a separate name, then switch to the saved root. Older application code ignores the additive fields. See [discounts guide](../discounts.md) for administration.
