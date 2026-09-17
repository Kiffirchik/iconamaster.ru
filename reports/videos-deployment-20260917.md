# Workshop video release — 17 September 2026

Published to MTW from GitHub-pushed source commit `733d888777a13c4fbb1d303d932c00398cc4fa5e`.

## Content

Four local films precede the two existing external videos at https://iconamaster.ru/video:

- `#mineral-paints` — Краски из минералов (0:41)
- `#icon-attribution` — Атрибуция древнерусской иконописи (4:06)
- `#ilya-muromets` — Житие святого богатыря Ильи Муромца (2:25)
- `#mineral-gemstones` — Минералы-самоцветы в иконописи (4:25)

The pigments article links to the first film. No new video sources are mounted before click.
Posters are real source frames. Three clips retain their -90 degree display metadata
(480 × 848 displayed); the animation is 736 × 864. All are H.264/AAC.

SHA-256 stream hashes of both video and audio match the owner-supplied originals.
MP4 remux only relocates metadata for faststart; no lossy re-encoding or cropped content.
Source filenames, file checksums, rotations and poster timestamps are in `video-import.json`.

## Checks

- Full verification passed: Windows setup, portability, 234 unit tests at that point,
  content/asset integrity, 6 static tests, 6 Sites compatibility tests, 4 MTW tests.
- Subsequent full unit run passed 235 tests after adding deployment coverage.
- Added a stale-output regression after review: both packaging tests passed.
- Independent UI/schema/import review and narrow deployment review completed;
  stale payload reuse was fixed with a fresh-directory requirement and exact inventory checks.
- Interruption-between-moves test restored the live directory.
- Local browser: desktop and 390 px mobile layout; all four clips played with native
  controls and correct dimensions. No horizontal overflow. Production-build anchors worked.
- Public HTTP verification: all four posters match SHA-256; all four MP4s return
  `video/mp4` and byte-identical 206 responses at start and middle offsets.
- Public video page has six SSR cards; no video/iframe player markup before click.
- New article link, managed JS/CSS hashes and core page responses verified.
- Live browser confirmed six cards, all four loaded posters, zero video players before
  click, native playback of the first film with 480 × 848 display dimensions, and
  a 390 px mobile layout without horizontal overflow.
- Existing icons, articles, pages, contacts and aliases JSON remain byte-identical.
- Corona, credentials, editor state, routing, verification file and icon restore paths preserved.

No Sites publication. The server Unix quota command reports no disk quota for the
account; this does not establish contractual traffic limits or billing policy.

## Publication and rollback

269 changed/new files: 258 HTML documents/templates, videos JSON, two hashed app assets,
four MP4s and four posters. Non-target HTML starts from the actual live snapshot and
only its JS/CSS references change. The video page and pigments page/template come from
the verified build; live article slots still use authoritative hosting JSON.

Rollback directory:
`/www/vhosts/27769/iconamaster.ru.rollback-before-videos-20260917`

Full archive:
`/www/vhosts/27769/iconamaster.ru.before-videos-20260917.tar.gz`

Archive SHA-256:
`a45119d88e3e16087cb52eef5b71b56e604e4064a094605bb8b16e908bc7a5d5`

Payload SHA-256:
`9a99f95be9060871cb625c230967c906b39bc73b45d1c80c92288843b80cc6af`

Published videos JSON SHA-256:
`ef9696167f3b4199a129c3c740cbf6a5142a3500fa55bd4fe521a1e5cd7cb801`

For rollback, first reconcile any later editor changes and acquire the shared editor
write lock. Preserve the current release separately; do not blindly replace current
JSON with an older backup.
