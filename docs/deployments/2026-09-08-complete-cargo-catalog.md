# Complete Cargo catalog release — 2026-09-08

Published to `https://iconamaster.ru` on MTW. No Sites deployment was made.

## Source and acceptance

- Deployed source: `efe8b1fb8bb0c4f476352e2a366bea78b513c9af`; GitHub `main` matched this commit before upload/cutover.
- Full Cargo inventory: 97 card records, 96 published at source, one hidden. Owner-confirmed Feodorovskaya duplicate merged; 95 public canonical cards, 45 more than the previous site.
- 144 immutable original image files, 120,940,525 bytes, verified against independent SHA-256 ownership evidence.
- 65 new deployment derivatives: 41.35 MB to 17.22 MB, 58.37% reduction. No crop, upscale or color transforms. All originals and 247 prior derivatives unchanged. MTW build contains 312 deployment derivatives.
- Source-backed metadata plus explicit owner correction: 21 period, 6 purpose, 79 size fields. Missing information stays blank. Authorship/provenance remain prose.
- Owner confirmations: Feodorovskaya merge at 150,000 RUB; Smolenskaya 20,000 RUB; George 9160368 200,000 RUB, icon 50 × 40 cm, kiot 64 × 54 cm, description corrected consistently.
- Two possible duplicate pairs deliberately remain separate pending identification: 9007316/9153754 and 9007346/9160289. Same titles are not treated as proof.

`npm run verify` passed on final application/content source: portability, 34 Windows setup tests, 196 unit tests, content/asset integrity, 118 canonical pages, 6 static tests, 6 compatibility-worker tests, 4 MTW packaging tests. The optional Pillow derivative verification passed for all 65 outputs and protected inputs. Offline migration replay was verified byte-identical across all eight generated data/report outputs before the final owner correction; final offline import and all tests also passed afterwards.

Browser checks: desktop card and 390 × 844 phone layout, purpose filter, same-tab next-card navigation. Expanded mobile header bottom 444 px, image top 489 px, no horizontal overflow. Temporary viewport override reset. Published George page visibly showed 200,000 RUB and corrected dimensions.

## Release and backup

Paths below are relative to `/www/vhosts/27769` on MTW, outside the served root unless explicitly inside `iconamaster.ru`.

| Artifact | Path | SHA-256 | Bytes |
|---|---|---|---:|
| Release | `iconamaster-cargo-20260908-144214.tar.gz` | `81ed6e9dcf3ccf8db37f0351172a52ea14e100df1515d2c7c8462bbc58d38e49` | 108138243 |
| Full pre-release backup | `iconamaster.ru.before-cargo-20260908-144214.tar.gz` | `74be7c7c55335c9386468194b69eabc33900e2c76566271bf7213b390706423c` | 145757564 |

Rollback directory: `iconamaster.ru.rollback-before-cargo-20260908-144214`.

All seven production content JSON files matched the previous committed baseline before publication; no intervening CMS content edits were overwritten. `corona`, `config.php`, `uploads` and `captcha` were copied intact into staging. Corona and config were compared with the active source before cutover. The release archive was hash-verified remotely; staging contained all 95 icon directories. The final pre-cutover icons hash was checked again. No old rollback artifacts were deleted.

## Production checks

107 HTTPS no-cache checks passed:

- All 95 canonical icon pages, plus `/`, `/collection`, `/contacts` and the featured restoration article, returned 200 and matched the verified static HTML byte-for-byte.
- Legacy Feodorovskaya duplicate and George URLs returned 301 to exact HTTPS canonical targets.
- Smolenskaya and George image bytes, `/content/icons.json`, and `/sitemap.xml` matched the release.
- Corona admin index returned its expected login redirect; the login page returned 200.

Published `content/icons.json` SHA-256: `23a5dbb22682c0224157d6bfd7243af899e9f228289feea90d08e2fdf02a08ab`.

## Exact rollback

Run only if rollback is requested, from the known MTW account. This preserves the new release too; no recursive deletion is required.

```sh
set -eu
cd /www/vhosts/27769
test -d iconamaster.ru
test ! -L iconamaster.ru
test -d iconamaster.ru.rollback-before-cargo-20260908-144214
test ! -e iconamaster.ru.failed-after-cargo-20260908-144214
mv iconamaster.ru iconamaster.ru.failed-after-cargo-20260908-144214
if mv iconamaster.ru.rollback-before-cargo-20260908-144214 iconamaster.ru; then
  exit 0
fi
mv iconamaster.ru.failed-after-cargo-20260908-144214 iconamaster.ru
exit 1
```

After rollback, verify home, catalog, a representative icon, and the Corona login page. If CMS content has changed since this release, preserve and reconcile those changes before reverting the whole root.
