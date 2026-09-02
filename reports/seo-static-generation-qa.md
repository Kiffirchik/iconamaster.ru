# Static SEO browser acceptance

Date: 2026-09-02
Build under test: `npm run build` output in `dist/client`
Preview: `npm run preview -- --host 127.0.0.1` (`http://127.0.0.1:4173`)

## Evidence

| Evidence | Viewport | Result |
| --- | --- | --- |
| `qa-output/seo-home-desktop.png` | 1440 x 1000 | Home page rendered as the approved dark museum layout. |
| `qa-output/seo-murals-desktop.png` | 1440 x 1000 | Murals service page, full page. |
| `qa-output/seo-murals-mobile.png` | 390 x 844 | Murals service page, full page. |
| `qa-output/seo-contacts-mobile.png` | 390 x 844 | Contacts page, full page. |

Browser screenshots have a 15 px vertical scrollbar, so their content widths are 1425 px and 375 px respectively.

## Desktop route checks (1440 px)

| Route | H1 / visible content | Metadata and link result |
| --- | --- | --- |
| `/` | One H1: `Иконы для молитвы. Произведения для поколений.` | One canonical (`https://iconamaster.ru/`), description, OG title/description, and JSON-LD script. Internal navigation remains ordinary `a[href]` links; WhatsApp, `tel:+79166554595`, and the mail link are visible. |
| `/raschistka-hramovyh-rospisey` | One H1: `Расчистка настенных храмовых росписей от копоти и загрязнений`. | The static HTML has the route-specific title, canonical, description, OG tags, and one JSON-LD script. Consultation links preserve WhatsApp, telephone, and email destinations. |
| `/icons/archangel-michael` | One H1: `Икона чудо Архистратига Михаила.` | One route-specific canonical, description, OG title/description, and JSON-LD script. Full icon images use `object-fit: contain`; no horizontal overflow. |
| `/contacts` | One H1: `Контакты`. | One route-specific canonical, description, OG title/description, and JSON-LD script. Address is `Московская область, д. Брёхово, Ромашковая ул., 16`; map target is `https://yandex.com/maps/-/CTT2bAoq`; WhatsApp, phone, and email are visible. |

## Mobile route checks (390 px)

`/raschistka-hramovyh-rospisey` and `/contacts` both measured `scrollWidth === clientWidth === 375`: no horizontal overflow. Service-page images remained within the 358 px content column without cropping. Readable headings, the footer address (`д. Брёхово, Московская область`), and 44 px-or-larger contact and footer navigation targets were present. The mobile flow Home → Menu → Мастерская → Расчистка росписей reached the service page and collapsed the menu afterwards.

## Client navigation and metadata

Using client-side header/home links (no explicit tab reload): Home → murals service → Home → Archangel Michael → Home → Contacts. At each destination, the title, canonical, description, OG title, OG description, and JSON-LD changed to the route-specific values and each selector had exactly one instance. The in-app browser reported no warning or error console entries during this pass. Visual snapshots immediately after route content settled showed no user-visible content flash or hydration warning.

## Contact destinations and goals

The contacts page retains `https://wa.me/79166554595`, `tel:+79166554595`, `mailto:iconamaster@yandex.ru`, and the Yandex Maps HTTPS URL. The in-app browser's read-only page evaluator could not replace `window.ym`; the local Metrika loader had not exposed `window.ym` (`typeof window.ym === 'undefined'`), so external contact navigation was not triggered. Existing focused test `tests/unit/analytics.test.mjs` verifies the browser call shape with a local `ym` stub: `[112185835, 'reachGoal', 'contact_whatsapp']`; the contact components retain `contact_whatsapp`, `contact_phone`, `contact_email`, and murals `murals_consultation` handlers while preserving their `href`s.

## Network and preview-server observation

All local route content, CSS, and visible images used the built preview without browser-console errors. The preview surface exposes no request-status API. A direct local HTTP check found a Vite-preview-only caveat: requesting a generated directory route without a trailing slash (for example `/raschistka-hramovyh-rospisey`) returns the root `index.html`; requesting `/raschistka-hramovyh-rospisey/` returns its static route HTML with the correct route metadata and `data-prerender-path`. The SPA then updates the no-slash preview route correctly. This is Vite preview directory fallback behavior, not a change to the generated per-route files; it is recorded as a release-environment concern, with no source fix made in this acceptance task.

## Outcome

Static artifacts, responsive presentation, menu navigation, contact destinations, and post-hydration metadata transitions passed. No source or design defect was changed. The no-slash Vite preview fallback and unavailable local Metrika function are the only acceptance limitations noted above.
