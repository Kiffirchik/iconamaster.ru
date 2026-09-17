# Levkas photograph display crop — 2026-09-17

Published source: `b38ec17ebda1ba47bd496f622db45dc477101861` (pushed before deployment).

- `/articles`: first Levkas photograph displayed square, top anchored.
- `/articles/levkas`: same photograph displayed at 6:7, top anchored.
- Original PNG and second photograph untouched. No image generation or pixel edits.
- Original SHA-256: `406b5659bb0ed704d87d2cbdda493c87143e5be4bf79624ec54737fabb7be566`.

Narrow overlay: 258 current live HTML files changed only by stylesheet reference replacement, plus one new CSS asset: `/assets/index-B4ckD9Zt.css`. Existing JavaScript, live JSON, Corona, editor state, routing and configuration preserved. Repository-generated content was not deployed.

Checks: CSS package behavioral test; content integrity; 160 original icon asset hashes; MTW build; interrupted directory-swap recovery; independent read-only review. Browser checks before/after at desktop and 390px mobile: cover ratio 1, article ratio approximately 0.85714, no mobile overflow. Both live pages loaded the new CSS and image successfully.

Rollback directory: `/www/vhosts/27769/iconamaster.ru.rollback-before-levkas-crop-20260917`.

Full archive: `/www/vhosts/27769/iconamaster.ru.before-levkas-crop-20260917.tar.gz`.

Archive SHA-256: `7738a8b4eb93ecc93600a56809773c5f585abd3d28e00401c5ea32346f4fbfe8`.

Payload SHA-256: `841ed45675493c156bb91fdb487e3a53389c7dc4fc4c4d54f42e965f93cca006`.

For rollback, preserve any subsequent live admin edits first; do not blindly replace current content with an older backup. The previous stylesheet `/assets/index-DsZ3cR2v.css` remains available.
