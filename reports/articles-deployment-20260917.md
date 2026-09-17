# Article publication — 17 September 2026

Published from GitHub-pushed source commit `ea17d7c` to MTW.

## New pages

- https://iconamaster.ru/articles/icon-painting-pigments — Краски в иконописи
- https://iconamaster.ru/articles/levkas — Левкас
- https://iconamaster.ru/articles/gold-leaf-gilding — Техники золочения икон листовым золотом: мордан, полимент, ассист

Source DOCX filenames and SHA-256 values are recorded in `docx-import.json`.
All prose and author credit retained. Five source tables were reflowed into
labelled text blocks using the existing article/editor schema. Repeated document
titles became page headings. Fourteen byte-identical embedded originals preserve
all fifteen placements (one image is reused twice in the pigments source).

## Deployment scope

26 files: article JSON, article list and three new static pages/live templates,
three route additions, private sitemap source, and fourteen images. The package
builder verified the original rewrite rules and route mappings remain unchanged.
The published JavaScript and CSS were not replaced.

The existing 18 article objects remain identical to the downloaded live baseline.
Other content JSON files were compared byte-for-byte against rollback after
deployment: icons (including visibility flags), pages, videos, contacts and aliases.
Corona files are unchanged. Existing `.editor-state` and credentials were preserved.

## Verification

- 229 unit tests passed, plus Windows setup, content/asset integrity and portability.
- Static tests 6/6, Sites compatibility tests 6/6, MTW packaging tests 4/4 passed.
  No Sites publication was performed.
- Updated stale expected article/route counts in tests to 21 / 134.
- `build:mtw` generated 134 canonical pages and 123 live templates.
- Desktop and 390 px mobile preview inspected, including table comparisons.
- Independent read-only review completed. Added and tested SIGTERM/EXIT recovery
  around the directory switch; simulated interruption restores the previous site.
- Public GET validation: 21 articles, every new page/list/sitemap entry, end-of-text
  credits, resolved live slots, all 14 original image SHA-256 values.
- Live browser confirmed all three articles at the top of the article listing.

## Recovery

Rollback directory:
`/www/vhosts/27769/iconamaster.ru.rollback-before-articles-20260917`

Full archive:
`/www/vhosts/27769/iconamaster.ru.before-articles-20260917.tar.gz`

Archive SHA-256:
`3c5a58e88c00a3f7014fb537725632c39a9933932e578161f4f80d7ac175bd97`

Payload SHA-256:
`88e2211f61995431bdedcd4cf1b2aea17dced01e062b87161b8c9c9edebcba7e`

Published articles JSON SHA-256:
`16a95faf4a97c866eee08bf1d0c56542ba890b986239194465cb7ddc3cedebbe`

Do not roll back blindly after subsequent admin edits. Acquire the editor lock,
back up the current site, reconcile newer content and editor-state, then switch
directories with failure/signal recovery. No rollback was required for this release.
