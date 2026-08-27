# Complete premium content migration — QA report

Date: 2026-08-27

## Scope

This report covers the complete data-backed premium prototype and its temporary public Sites deployment. The production domain `iconamaster.ru` was not changed.

Public preview:

- https://iconamaster-premium-preview.deniskalachinov.chatgpt.site/
- Sites version: 7
- Public release source: `8387046468d34d7d4eea9a8972fea834d3d86e4f`
- Working implementation head before this report: `aa09a72`

## Content contract

| Content type | Verified result |
| --- | ---: |
| Published icons | 50 |
| Icon originals | 79 |
| Service/editorial pages | 7 |
| Articles | 8 |
| Videos | 2 |
| Legacy aliases | 78 |
| Owned local assets | 258 |

All required records are published, all structured blocks are non-empty, and no executable legacy HTML is rendered.

## Local route matrix

Every route below was checked at 1440 × 1000, 1024 × 768, 390 × 844, and 360 × 844:

| Route | 1440 | 1024 | 390 | 360 |
| --- | --- | --- | --- | --- |
| `/` | PASS | PASS | PASS | PASS |
| `/collection` | PASS | PASS | PASS | PASS |
| `/icons/facade-george` (multi-image) | PASS | PASS | PASS | PASS |
| `/icons/bogolyubskaya-with-saints` (single-image) | PASS | PASS | PASS | PASS |
| `/workshop` | PASS | PASS | PASS | PASS |
| `/excursions` | PASS | PASS | PASS | PASS |
| `/measure-icon` | PASS | PASS | PASS | PASS |
| `/restoration` | PASS | PASS | PASS | PASS |
| `/kiots` | PASS | PASS | PASS | PASS |
| `/oklads` | PASS | PASS | PASS | PASS |
| `/iconostases` | PASS | PASS | PASS | PASS |
| `/articles` | PASS | PASS | PASS | PASS |
| `/articles/gorbunov-icons-kholuy` | PASS | PASS | PASS | PASS |
| `/video` | PASS | PASS | PASS | PASS |
| `/contacts` | PASS | PASS | PASS | PASS |
| `/EKSKURSIY-PO-MASTERSKOI` | PASS | PASS | PASS | PASS |
| `/does-not-exist` | PASS | PASS | PASS | PASS |

Total: 68 route/viewport combinations passed with:

- correct non-empty `h1` and page content;
- no horizontal overflow;
- no header/main overlap;
- no broken visible images;
- no internal `target="_blank"`;
- no unresolved loading state;
- no iframe before video activation.

## Public route verification

Direct navigation on Sites was verified after correcting the worker fallback and explicitly rebuilding `dist`.

| Public route | Expected heading | Desktop | 390 px | 360 px |
| --- | --- | --- | --- | --- |
| `/` | Иконы для молитвы. Произведения для поколений. | PASS | PASS | PASS |
| `/collection` | Иконы в наличии | PASS | PASS | PASS |
| `/icons/facade-george` | Фасадная икона Чудо Георгия о змие. | PASS | PASS | PASS |
| `/articles/gorbunov-icons-kholuy` | Иконы Горбуновых из села Холуя | PASS | PASS | PASS |
| `/video` | Видео | PASS | PASS | PASS |
| `/EKSKURSIY-PO-MASTERSKOI` | Экскурсия по мастерской | PASS | n/a | n/a |

Observed public navigation times in the signed browser session were approximately 0.9–2.7 seconds after deployment. These are smoke-test observations, not a controlled Lighthouse benchmark.

## Interaction and accessibility

- Mobile menu expands in document flow; header bottom equals main top and the page does not widen.
- Escape closes the menu and restores focus to the Menu button.
- Workshop disclosure, navigation-close behavior, and focus transfer to `main#main-content` passed locally.
- The gallery locks body scroll while open, closes with Escape, restores scroll, and returns focus to its trigger.
- Native Enter/Space activation could not be synthesized by the in-app browser harness; the control remains a semantic native `button`. Pointer and Escape behavior passed.

## Video policy

- Zero iframes and no YouTube/Vimeo resources before activation.
- Clicking “Смотреть видео” creates one privacy-enhanced iframe.
- Verified source: `https://www.youtube-nocookie.com/embed/y10sw1KIOqQ?autoplay=0`.
- Autoplay with sound is not enabled.

## Image and performance checks

- Homepage hero is `loading="eager"`; following homepage images are lazy.
- Public desktop hero completed with a 1570 px natural width and no broken-image state.
- Public checks found no broken visible images on the tested routes.
- Delivery JPEGs were reduced from 205.21 MiB to 71.22 MiB without crop or enlargement; the archive is 86,855,680 bytes.
- No public console errors were recorded.
- Browser Performance API values were unavailable in the in-app harness; this is an external tooling limitation.

## Routing incident and correction

The first public smoke test showed every direct route returning the homepage. Investigation found:

1. Sites static assets returned a redirect for app paths.
2. A regression test was added and observed failing with `307 !== 200`.
3. The worker was changed to serve the SPA shell from the root asset while preserving the browser path.
4. The packaging helper was found to reuse an existing `dist`; explicit `npm run build` was added before packaging.
5. The final archive was inspected and confirmed to contain the corrected worker and no temporary diagnostics.

The final public route matrix passed.

### Correction record

| Finding | Correction | Verification evidence |
| --- | --- | --- |
| Direct Sites routes returned `307` and landed on `/`. | Added redirect-aware SPA fallback in `worker/index.js`; the shell is fetched from the root asset while the requested browser path is preserved. | Red/green worker regression: observed `307 !== 200`, then 5/5 Sites tests passed. Working commits `136bb42` and `aa09a72`. |
| Saved Sites versions still contained the old worker. | Added an explicit successful `npm run build` before packaging and inspected `dist/server/index.js` inside the archive. | Public Sites version 7 preserved every tested direct path and heading. Release source `8387046`. |
| Source repository transfer exceeded the practical upload window. | Created a separate delivery source snapshot with non-cropping JPEG derivatives while retaining verified originals in the working branch. | JPEG delivery bytes reduced from 205.21 MiB to 71.22 MiB; public archive 86,855,680 bytes; public image checks passed. |
| The packaging gate checked only file existence. | Added a behavior test importing `dist/server/index.js` and exercising a direct app route. | Mutation to stale `/index.html` fallback failed with `307 !== 200`; rebuild restored 6/6 Sites tests. |

## Final verification

`npm run verify` passed after the final worker change:

- 114 unit/integration tests passed;
- content and asset integrity gates passed;
- production Vite build passed;
- 6 Sites worker/packaging tests passed.

After the final public verification, no further source correction was required.

final result: passed
