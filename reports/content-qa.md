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

The following representative routes were checked at 1440 × 1000, 1024 × 768, 390 × 844, and 360 × 844:

| Route family | Representative routes | Result |
| --- | --- | --- |
| Home/catalog | `/`, `/collection` | PASS |
| Icon details | multi-image and single-image records | PASS |
| Workshop pages | all seven service pages | PASS |
| Editorial | index and long article | PASS |
| Video/contact | `/video`, `/contacts` | PASS |
| Compatibility | legacy alias and unknown route | PASS |

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

## Final verification

`npm run verify` passed after the final worker change:

- 114 unit/integration tests passed;
- content and asset integrity gates passed;
- production Vite build passed;
- 5 Sites worker/packaging tests passed.

No Task 10 source corrections were required after the final public verification.

final result: passed
