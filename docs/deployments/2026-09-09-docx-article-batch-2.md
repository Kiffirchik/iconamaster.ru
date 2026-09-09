# DOCX article publication, batch 2 — 2026-09-09

- Production: `https://iconamaster.ru`, MTW.
- Application source: `5ad6267f4eaa3d75370652cd33991c20565b1620`, pushed to `origin/codex/iconamaster-production-release` before publication.
- Artifact: `iconamaster-docx2-20260909.tar.gz`, 121440679 bytes.
- Artifact SHA-256: `3898b20b165fc28b79aec8529b6418f1166f5be7bb251c477a0b7a0f7519d49e`.
- Published `content/articles.json` SHA-256: `b2d9d852762459c4e1e4fb82b481be8ac7a5b6ef9ef73367ab8c1f40c0723bbe`.

## Published content

- `/articles/vetka-icon-painting`: new article, 7 original illustrations.
- `/articles/palekh-icon-painting`: new article, 7 original illustrations.
- `/articles/peshekhonov-icon-painting`: new article, 3 original illustrations.
- The 12 existing article records were preserved exactly; the Articles index now contains 15 materials.
- All 17 added image files preserve the original DOCX bytes. Only the exact terminal source suffix `elib.rshu.ru +1` was removed from the Vetka text.
- Existing Corona editor, configuration, uploads, captcha data and `.editor-state` were copied from the live site and byte-checked before cutover.

## Verification

- Full `npm run verify` passed: portability, 34 setup tests, 208 unit tests, content and asset ownership checks, both builds, 6 static tests, 6 Sites-compatibility tests and 4 MTW tests.
- Content verification passed for 95 icons, 8 pages, 15 articles, 2 videos, 124 aliases and 377 owned assets. Static generation produced 124 canonical pages and 113 Corona-editable routes; `/privacy` remains intentionally static.
- Independent scoped and full-range reviews found no critical, important or minor issues.
- Production verification passed for all 15 article routes and 40 original DOCX assets. The homepage, article index, catalog, icon detail and privacy pages returned successfully; sitemap contains 124 canonical URLs.
- Private storage returns HTTP 403 and anonymous Corona editor access redirects to authentication.
- Desktop visual checks passed for the index and all three articles. At a 390 × 844 mobile viewport the published Peshekhonov article reported `viewport=390`, `documentWidth=390`, `bodyWidth=390` and no overflowing elements.

## Recovery

- Full pre-release backup: `/www/vhosts/27769/iconamaster.ru.before-docx2-20260909.tar.gz`, 169390332 bytes.
- Backup SHA-256: `caf11da2ec5dee58e69ed8d7df05111c1c8af3cbe8e843138cc234b2176320a2`.
- Previous document root: `/www/vhosts/27769/iconamaster.ru.rollback-before-docx2-20260909`.
- Baseline hashes: `/www/vhosts/27769/docx2-baseline-20260909.sha256`.

Before any rollback, save the current root, live JSON and `.editor-state` outside the public root so later editorial changes are not lost. Then perform a checked directory swap from `/www/vhosts/27769`:

```sh
mv iconamaster.ru iconamaster.ru.failed-docx2-20260909
mv iconamaster.ru.rollback-before-docx2-20260909 iconamaster.ru
```

Do not recursively delete either site root during recovery. Existing credentials were neither changed nor committed.
