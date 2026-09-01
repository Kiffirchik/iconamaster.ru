# Georgievsky church article image rotation

- Deployed: 2026-09-01
- Production URL: `https://iconamaster.ru/articles/georgievsky-church-iconostasis`
- Source commits: `892f462`, `80be8ab`
- Scope: two corrected article photographs and `content/articles.json`
- Cache handling: the corrected photographs use new `-upright.jpg` URLs because the previous assets were served with a ten-year browser cache lifetime.
- Pre-deployment backup: `backups/production-before-article-rotation-20260901-212858`

## Verification

- Page returned HTTP 200.
- `georgievsky-church-iconostasis-5-upright.jpg` SHA-256: `7cdc214d825198454602f3b4ab9419da45a401709ea6ac752162bf3142010b8b`
- `georgievsky-church-iconostasis-6-upright.jpg` SHA-256: `d594c1b311e8849d67a2db0b12bdc3fe19415124ea49fe00729c70fc40dbd76f`
- Production `articles.json` SHA-256: `5d16fea3997572b0b2bfe160768529ca8f09d56491b5519b1b32a8925d91a4d9`
- Production content references both new `-upright.jpg` assets.
- Full `npm run verify` completed successfully: 125 unit tests, content and asset verification, Sites packaging tests, and MTW packaging tests.

## Rollback

Upload the three files from the pre-deployment backup to the same production paths. The new `-upright.jpg` files may remain unreferenced without affecting the rollback.
