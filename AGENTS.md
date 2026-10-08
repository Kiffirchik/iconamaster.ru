# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Iconamaster prototype constraints

### Approved materials copy publication — 8 October 2026

- The owner approved the homepage introduction «Рукописные иконы Московской мастерской» explaining that the workshop prepares paints by hand from mineral pigments, and a «Как мы готовим краски для икон →» link to `/articles/icon-painting-pigments`.
- Add the approved «Минеральные краски в нашей мастерской» opening to that article before its original illustrated historical content. Preserve all historical prose, images and their order; do not imply that every pigment described historically is used by the workshop today.
- The owner approved publication of this reviewed copy to MTW on 8 October 2026. Commit and push the verified source first, preserve live editor data, and retain a rollback copy. No basket, payment flow or order form is included: the existing order link opens WhatsApp, and the workshop receives a message only after the visitor sends it.
- In the same request the owner approved tightening advertising exclusions and price keywords, and preparing separate product and catalogue campaigns. Do not activate either campaign or assign a new test budget/date before agreement.

### Approved local shop preview — 7 October 2026

- The owner approved publication of this reviewed shop preview to MTW on 7 October 2026. Commit and push the verified source first, preserve live editable data and a rollback copy. Do not change ads. Purchase, payment and delivery changes are deferred.
- Retain the dark museum styling and compact introduction before the homepage catalog strip and editorial material. The strip includes all published, illustrated catalog works, with the eight curated slugs first and the rest in catalog order. Default to «В наличии» and offer «Все работы» and the actual availability states. Do not invent prices or availability; never include hidden works. Keep the separate full catalog unchanged.
- Add an «Образ / святой» filter to the selection and catalog. Multi-subject works belong to each relevant subject; distinguish namesakes and iconographic meanings.
- Use the horizontal strip on desktop and mobile: roughly 3–4 cards plus a next-card edge on wide screens, one large card plus an edge on phones. Desktop buttons advance by the visible group; mobile buttons advance one card. Keep a visible range counter, keyboard controls, no autoplay, no hijacking of vertical scrolling, reduced-motion support and reset on filter changes. Show compact homepage cards (photo, full title, price/availability and contact/detail links), leaving specifications on detail pages and in the separate catalog. Load images beyond the first group lazily.
- Use the owner's «Дом мастерская русского иконописца.docx» for a short family-workshop history, not a long biography or awards list.
- Show the original Blessing.jpeg with the precise description: Patriarch Alexy II's certificate given to the workshop collective on 14 May 2007. Do not imply a blanket endorsement of every item. Link to the complete original photograph.
- Public content/icons.json was reconciled read-only into the local preview on 7 October; preserve those live-editor prices, availability, purpose, description and publication edits in any future reconciliation.

- The approved dark museum mock controls layout and visual hierarchy, not icon content.
- Icon files are immutable originals. Do not use ImageGen, pixel editing, generative fill, or handcrafted replacements on them.
- Preview crops may remove only incidental photographic background; full images always use `object-fit: contain`.
- WhatsApp is primary; phone and email remain visible alternatives.
- Requested production changes are published directly to `https://iconamaster.ru` on MTW with a rollback copy preserved.
- Do not publish subsequent changes to Sites unless the user explicitly requests it.
- Before every MTW production deployment, commit and push the exact verified source to `https://github.com/Kiffirchik/iconamaster.ru`; deploy only after that push succeeds.
- Live text editing is enabled at `/corona/admin/content.php`. Hosting `content/*.json` is authoritative for edited text: preserve it and `.editor-state` during subsequent deployments. Never overwrite live edits with a Cargo export or repository snapshot without explicit reconciliation. Use `npm run build:mtw` to include the PHP editor and live templates; preserve the existing Corona login and its credentials.
