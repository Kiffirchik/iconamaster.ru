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

The initial pass found no design defect, but its Vite-preview clean-path and local-goal limitations were superseded by the correction and evidence in Fix Round 1 below.

## Fix Round 1 — preview routing and instrumented interactions

### Reproduced and corrected clean-path preview behavior

The initial focused regression reproduced the defect: Vite preview answered `GET /raschistka-hramovyh-rospisey` with the root prerendered document (`data-prerender-path="/"` and the home title), rather than `dist/client/raschistka-hramovyh-rospisey/index.html`. The regression now starts an actual Vite preview on an ephemeral local port and asserts that the exact no-slash URL returns status 200, the murals title, and `data-prerender-path="/raschistka-hramovyh-rospisey"`.

The smallest correction is a preview-server-only middleware in `vite.config.mjs`: for a safe GET/HEAD clean path it serves that route's generated `index.html` when present. It does not change `dist/client`, Apache rules, the worker, or production routing. After the change, direct HTTP checks and the browser both returned the exact prerendered document before hydration for `/raschistka-hramovyh-rospisey`, `/icons/archangel-michael`, and `/contacts`; each response was 200 and had the appropriate route title and prerender path. `node --test tests/static-build.test.mjs` was RED before the correction and GREEN afterwards (5/5).

### Browser-side metadata transition evidence

The following were clicked through the SPA without a tab reload: Home → murals service → Home → Archangel Michael → Home → Contacts. At every hop there was exactly one managed title, canonical, description, OG title, OG description, and JSON-LD node (`data-seo-managed` count = 1 for each applicable tag; managed JSON-LD script count = 1).

| Route after SPA navigation | Title / canonical | Description and OG description | JSON-LD identity |
| --- | --- | --- | --- |
| `/` | `Московская иконописная мастерская` · `https://iconamaster.ru/` | `Московская иконописная мастерская: иконы, реставрация и храмовые росписи.` | 1 LocalBusiness document |
| `/raschistka-hramovyh-rospisey` | `Расчистка настенных храмовых росписей от копоти и загрязнений \| Московская иконописная мастерская` · `https://iconamaster.ru/raschistka-hramovyh-rospisey` | `Бережно удаляем копоть и загрязнения с храмовой стенописи, укрепляем повреждённые участки и сохраняем действующую роспись.` | 1 graph: Service + BreadcrumbList |
| `/icons/archangel-michael` | `Икона чудо Архистратига Михаила. \| Московская иконописная мастерская` · `https://iconamaster.ru/icons/archangel-michael` | `21 х 17 см. доска липовая с ковчегом и двумя врезными шпонками, холст, натуральный левкас, настоящая минеральная яичная темпера, золото сусальное, копаловый…` | 1 graph: VisualArtwork + Product + BreadcrumbList |
| `/contacts` | `Контакты \| Московская иконописная мастерская` · `https://iconamaster.ru/contacts` | `Контакты Московской иконописной мастерской.` | 1 graph: LocalBusiness + BreadcrumbList |

The observed OG title matched each row's title. No warning/error console entries appeared during this recheck. The exact clean service page was already prerendered on initial browser load, so there was no observed title/content replacement flash during hydration.

### Real local browser contact instrumentation and safe clicks

An opt-in local-preview query (`?__qa_contact_instrument=1`) adds no production code or artifact change. It stubs `window.ym`, reads the original anchor contract, and intercepts only contact activation at capture phase after recording it. Each entry below was activated in the browser through its rendered anchor; the address stayed on the local preview page, no external popup or operating-system handler was launched, and the recorded `defaultPrevented` changed from `false` to `true`.

| Rendered target clicked | Original href / target | Recorded goal sequence |
| --- | --- | --- |
| Contacts WhatsApp | `https://wa.me/79166554595` / `_blank` (`rel=noreferrer`) | `contact-click` → `contact-navigation-intercepted` → `[112185835, "reachGoal", "contact_whatsapp"]` |
| Contacts phone | `tel:+79166554595` / no target | `contact-click` → `contact-navigation-intercepted` → `[112185835, "reachGoal", "contact_phone"]` |
| Contacts email | `mailto:iconamaster@yandex.ru` / no target | `contact-click` → `contact-navigation-intercepted` → `[112185835, "reachGoal", "contact_email"]` |
| Murals primary consultation CTA | `https://wa.me/79166554595?text=…` / `_blank` (`rel=noreferrer`) | `contact-click` → `contact-navigation-intercepted` → `[112185835, "reachGoal", "murals_consultation"]` → `[112185835, "reachGoal", "contact_whatsapp"]` |

The targeted test also executes the emitted instrumentation with a local VM event and confirms the click record, interception state, and phone goal call. This provides a regression for the test-only guard as well as the live-browser click coverage.

### Mobile recapture and lazy-image evidence

The required embedded in-app browser was subsequently available for the replacement capture. At the actual `390 × 844` viewport, the exact clean URL reported `innerWidth=390`, `innerHeight=844`, `location.pathname=/raschistka-hramovyh-rospisey`, and `data-prerender-path=/raschistka-hramovyh-rospisey`; title and H1 were the route-specific murals values. Before capture it was scrolled to `y=2300`, after which all three content images were complete with natural widths `1243`, `1200`, and `960`. The replacement [`qa-output/seo-murals-mobile.png`](../qa-output/seo-murals-mobile.png) is 294,791 bytes and visually contains the formerly blank third scaffold image. The embedded viewport was reset and its tab closed after capture.

### Mobile target measurements (IAB, innerWidth 390)

| Target | Measured size in CSS px |
| --- | --- |
| Menu button | 72.58 × 45.19 |
| Leading primary murals CTA | 308 × 72.38 |
| Leading phone / email | 192.61 × 44 / 245.39 × 44 |
| Closing primary murals CTA | 308 × 72.38 |
| Closing phone / email | 192.61 × 44 / 245.39 × 44 |
| Footer WhatsApp / phone / email | 192.77 × 44 / 192.61 × 44 / 245.39 × 44 |
| Footer nav: Главная / Иконы / Реставрация / Расчистка / Статьи / Видео / Контакты | 58.02 × 44 / 129.88 × 44 / 92.39 × 44 / 147.02 × 44 / 48.53 × 44 / 44.97 × 44 / 68.47 × 44 |
| Open-menu: Главная / Иконы | 122.09 × 44 / 122.09 × 44 |
| Open-menu: Расчистка росписей | 106.09 × 48.13 |
| Open-menu: Реставрация / Статьи / Видео / Контакты | each 122.09 × 44 |
| All other workshop submenu links | at least 44 px high (two-line links 48.13 px high) |

Every measured interactive target satisfies the required 44 px minimum.

## Fix Round 2 — malformed preview paths and contacts-card hitboxes

### Controlled malformed-path behavior

RED: requesting `/%E0%A4%A` through a real Vite preview rejected the asynchronous middleware with an unhandled `URIError: URI malformed`. GREEN: decoding is now guarded inside the preview-only middleware; that exact request returns the controlled plain-text response `400 Bad Request` and the focused static-preview suite passes 6/6. Canonical clean-path serving remains covered by the same suite.

While rerunning the full gate, Node's default parallel execution reproducibly cancelled Vite compilation in the Vite-backed `content-loader` tests even though that file passed alone and all 178 tests passed with `--test-concurrency=1`. A source-backed regression now locks the unit runner to that sequential setting. This is a test-runner stability correction only; `npm run verify` then passed in full (178 unit tests, content/assets/static/Sites/MTW gates).

### Contacts card (IAB, innerWidth 390)

The IAB opened the exact `/contacts` route (`Контакты | Московская иконописная мастерская`), measured the rendered card, then reset its viewport and closed the tab. All four visible primary contact-card controls meet the 44 px minimum and retain their destination contract.

| Rendered control | Measured size in CSS px | href | target / rel |
| --- | --- | --- | --- |
| `Написать в WhatsApp` | 308 × 46.78 | `https://wa.me/79166554595` | `_blank` / `noreferrer` |
| `+79166554595` | 308 × 44 | `tel:+79166554595` | none / none |
| `iconamaster@yandex.ru` | 308 × 44 | `mailto:iconamaster@yandex.ru` | none / none |
| `Открыть в Яндекс Картах` | 308 × 44 | `https://yandex.com/maps/-/CTT2bAoq` | `_blank` / `noreferrer` |
