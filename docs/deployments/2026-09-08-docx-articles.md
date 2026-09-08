# DOCX article publication — 2026-09-08

- Production: `https://iconamaster.ru`, MTW.
- Application source: `9d5f806c6fecf7242c6e6471ecccf1147cf31557`, pushed to `origin/codex/iconamaster-production-release` before publication.
- Artifact: `iconamaster-docx-20260908.tar.gz`, 114439364 bytes.
- Artifact SHA-256: `35d831f1c1e786dde781080074e43fca9afe5477ad1c6985b0051c640925e4a7`.

## Published content

- `/articles/history-of-cast-icons`: new article, 8 original illustrations.
- `/articles/cast-crosses`: new article, 12 original illustrations and table captions.
- `/articles/panteleimon-monastery-icons`: supplemented, URL retained, no duplicate. Three additional images; existing text and five images retained.
- Nine other live articles preserved exactly, including current Guslitsa and mural-cleaning edits. Six other hosting JSON files unchanged.
- New articles appear first in the Articles index; homepage featured selection unchanged.

## Verification

- Full `npm run verify`: portability, 34 setup tests, 201 unit tests, content and asset ownership checks, both builds, 6 static tests, 6 Sites-compatibility tests and 4 MTW tests passed. No Sites publication.
- Original document text/image audit and independent review passed. All 23 added image files match their DOCX bytes; three additional source images already existed and were not duplicated.
- Desktop and 390px mobile browser checks passed. Published index shows both new articles with loaded covers.
- Server PHP 5.2 syntax passed. All 110 live PHP routes matched React main markup, normalizing only empty React text-boundary comments and equivalent apostrophe entities (`&#x27;` / `&#039;`). The first conservative comparison stopped before cutover; no application fix was required.
- Immediately before cutover: all seven baseline hosting JSON hashes unchanged; nine unaffected articles deep-equal; Corona and configuration byte-equal; `.editor-state` preserved with mode 700.
- After cutover: all 12 article routes returned HTTP 200 with matching titles and image references; hosting article JSON matched source exactly; all 23 public images matched SHA-256; homepage, catalog and an icon card returned 200. Sitemap has 120 canonical URLs including both additions. Private templates/state return 403; anonymous editor redirects to login.

## Recovery

- Full pre-import backup: `/www/vhosts/27769/iconamaster.ru.before-docx-20260908.tar.gz`, 163179034 bytes.
- Backup SHA-256: `2cd6b0382beb41910225ef194236721c287e31dfbfa003f3d89588cc4ee85480`.
- Previous document root: `/www/vhosts/27769/iconamaster.ru.rollback-before-docx-20260908`.
- Baseline hashes: `/www/vhosts/27769/docx-baseline-20260908.sha256`.

Before any later rollback, save the current root, live JSON and `.editor-state` outside the public root so edits made after this publication are not lost. Restore the prior root by a checked directory swap; do not recursively delete the live site. Existing credentials were neither changed nor committed.
