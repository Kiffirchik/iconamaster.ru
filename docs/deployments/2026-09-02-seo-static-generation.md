# Static SEO release to MTW

Published on 2026-09-03 to `https://iconamaster.ru`.

## Verified source and release

- Deployed source commit: `1227562030676bac43f6ae8930a111357d55ebe3`.
- GitHub `refs/heads/main` matched the deployed source commit before packaging.
- Local and remote release archive: `iconamaster-seo-static-20260903-172921.tar.gz`.
- Release archive SHA-256: `cf8c31e7a8688f382b318096315259b5dd6e2621068e4d6dcfa9aea5874d5f24`.
- Release archive size: 90,927,213 bytes; 441 archive entries.
- `npm run verify` passed on the exact source before publication: 34 setup tests, 181 unit tests, content and asset integrity, 73 generated canonical pages, 6 static-build tests, 6 Sites-worker tests, and 4 MTW packaging tests.
- The release preserved `corona`, `config.php`, `uploads`, and `captcha` from the previously active root.

## Current rollback artifacts

- Rollback directory: `iconamaster.ru.rollback-before-seo-static-20260903-172921`.
- Backup archive: `iconamaster.ru.before-seo-static-20260903-172921.tar.gz`.
- Backup archive SHA-256: `1a87543c530ec4edcfa18e76a5aa829542cb8d6971b2d20412e35d7260ced332`.
- Backup archive size: 146,074,475 bytes.
- The backup was listed and required `index.html`, `corona/admin/index.php`, `config.php`, `uploads`, and `captcha` before cutover.

All paths above are relative to `/www/vhosts/27769` on MTW. No rollback or failed-release artifact was deleted.

## Production acceptance evidence

Requests bypassed unstable local DNS with the resolved MTW address and used `Cache-Control: no-cache`. TLS still targeted `iconamaster.ru`.

| Route | Status | Required evidence |
|---|---:|---|
| `/` | 200 | Russian H1, canonical `https://iconamaster.ru/`, JSON-LD, Metrica `112185835` |
| `/collection` | 200 | Russian H1, route canonical, JSON-LD, Metrica `112185835`, no redirect |
| `/raschistka-hramovyh-rospisey` | 200 | Russian H1, route canonical, JSON-LD, Metrica `112185835` |
| `/icons/archangel-michael` | 200 | Russian H1, route canonical, JSON-LD, Metrica `112185835` |
| `/articles/restoration-murals-cleaning` | 200 | Russian H1, route canonical, JSON-LD, Metrica `112185835` |
| `/contacts` | 200 | Russian H1, route canonical, JSON-LD, Metrica `112185835` |
| `/robots.txt` | 200 | `text/plain` and `Sitemap: https://iconamaster.ru/sitemap.xml` |
| `/sitemap.xml` | 200 | XML content type and exactly 73 `<url>` entries |
| `/EKSKURSIY-PO-MASTERSKOI` | 301 | Exact `Location: https://iconamaster.ru/excursions` |
| `/collection/` | 301 | Exact `Location: https://iconamaster.ru/collection` |
| `/__qa_unknown_20260903_172921` | 404 | `noindex,follow` |
| `/corona/admin/index.php` | 302, then 200 | Redirected to `/corona/admin/login.php`; login page loaded |

Direct requests to `/assets`, `/content`, `/uploads`, `/captcha`, `/corona`, and `/corona/admin` returned 403 with no directory listing. This confirms `Options -Indexes` is effective while individual files and the Corona login flow remain available.

Representative published files matched the verified release byte-for-byte:

| File | HTTP | SHA-256 |
|---|---:|---|
| `/assets/index-zdrp4PmJ.js` | 200 | `046788f0b125d71ce0c66895083f2c0a68f76928cbbaf3be1e4ab5bd69446df1` |
| `/assets/index-Db6GCIYu.css` | 200 | `6217e94c976d09fcef3e3075fb77d66a51d5f5e2961630de5ad18669564a120a` |
| `/assets/icons/archangel-michael.jpg` | 200 | `087dbb515bc25f19cae14d5456e1ebd38b1b87d7cc7ae2898288ac28dd8742b7` |
| `/assets/articles/dzen/restoration-murals-cleaning-1.jpg` | 200 | `a3b0f6c3a245453991fccb581a3eaae094740592ec77bea8b8c364fbdade6d71` |
| `/content/icons.json` | 200 | `8bf6c9393f48aa89f44c3167080a8850346db1476b45cf18168169a32e2e8bfd` |

The active `.htaccess` SHA-256 on MTW was `0a6e083a82deb38c870702f61d5a00340f95ebc29050c85212bcc5485518dd9d`.

## Reversible release history

Three earlier candidates were cut over, failed a critical no-cache smoke check, and were immediately reversed. The previous public site was rechecked after every reversal.

| Stamp | Source commit | Release SHA-256 | Backup SHA-256 | Failure | Preserved failed directory |
|---|---|---|---|---|---|
| `20260903-163959` | `3690ec850e0b18670b808b673cd02547eb499fb5` | `43be5f137d304195de1b45a34805b76d283deb5b3867a6657d013f40b13f2825` | `1f0c3098b9f640effd051cd5f4e183ff3c082cf7483cc16e5c19ef08bd2a30ca` | `/collection` was redirected to an insecure trailing-slash URL | `iconamaster.ru.failed-seo-static-20260903-163959` |
| `20260903-171058` | `fb626cb4667d50d5180360d0c024c6b4d8d634b5` | `d45ad88d7731f743db19d84d963b307559cc33fe59747b540071cd3d8b0a6cb2` | `c8ebffdc39f2b26c78c7b1bb32d94a47e4700794aa9e61b16aec44774c00f170` | Unsupported `DirectoryCheckHandler` caused HTTP 500 | `iconamaster.ru.failed-seo-static-20260903-171058` |
| `20260903-171838` | `c9074696311f00f7ea5ff2ddd5357cea4cfbd906` | `2992174973665128556ff13263de71b34a69caf015e726c402f6733921cab089` | `d98898250297d408388c5cdf51fc468262435e53d4279e825e671cbcee3a7078` | A path-only legacy redirect inherited HTTP from the nginx-to-Apache hop | `iconamaster.ru.failed-seo-static-20260903-171838` |

The release archives and backup archives for all four stamps remain under `/www/vhosts/27769`.

## Exact rollback transaction

Run from `/www/vhosts/27769` on MTW. The destination name must not already exist.

```sh
set -eu
cd /www/vhosts/27769
test -d iconamaster.ru
test -d iconamaster.ru.rollback-before-seo-static-20260903-172921
test ! -e iconamaster.ru.failed-after-seo-static-20260903-172921
mv iconamaster.ru iconamaster.ru.failed-after-seo-static-20260903-172921
if mv iconamaster.ru.rollback-before-seo-static-20260903-172921 iconamaster.ru; then
  exit 0
fi
mv iconamaster.ru.failed-after-seo-static-20260903-172921 iconamaster.ru
exit 1
```

After rollback, recheck `/`, `/collection`, and `/corona/admin/index.php` before considering the reversal complete.
