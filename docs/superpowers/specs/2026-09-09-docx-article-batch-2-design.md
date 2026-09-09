# DOCX Article Batch 2 Design

## Scope

Publish three owner-supplied Word documents as new articles on `iconamaster.ru`:

1. `Ветковская школа иконописи..docx` as **Иконописная традиция Ветки** at `/articles/vetka-icon-painting`.
2. `Иконописные традиции села Палех.docx` as **Иконописные традиции села Палех** at `/articles/palekh-icon-painting`.
3. `Пешехоновская икона. Византийский стиль.docx` as **Пешехоновская икона. Византийский стиль** at `/articles/peshekhonov-icon-painting`.

The three records are new and appear before the current twelve articles in the listed order. No existing article is replaced.

## Content treatment

- Preserve all source body paragraphs and every embedded original image in document order.
- Use the first embedded image as the article cover without changing its bytes.
- Preserve source image captions as prose immediately after their images.
- Use the source's semantic headings as article section headings.
- Omit document title paragraphs from the article body because the article page already renders the title as its H1.
- For the Пешехонов article, retain the second title line as the first section heading.
- Remove only the reviewed literal source-debris suffix ` elib.rshu.ru +1` from the Ветка document. Preserve all other wording, spelling, punctuation, and factual claims as supplied.
- Do not create empty image spaces or placeholder blocks.

## Provenance and integrity

- Record each document SHA-256, paragraph count, image count, dimensions, byte length, immutable asset SHA-256, and DOCX member path in `reports/docx-import.json`.
- Expected document counts are: Ветка 49 text paragraphs and 7 images; Палех 38 text paragraphs and 7 images; Пешехонов 36 text paragraphs and 3 images.
- The source images have no byte-for-byte duplicates in the current article asset library.
- Every new asset belongs to exactly one article and remains covered by the existing project-wide ownership verifier.
- Extend the DOCX source-reference allowlist only for the three exact new slug/reference pairs.

## Release safety

- Treat the hosting `content/*.json` files as authoritative immediately before import and deployment so Corona editor changes are retained.
- Verify that the current production baseline contains the same twelve article records before applying the additive import.
- Run the complete project verification, responsive browser QA, and asset checks before release.
- Commit and push the exact verified source to GitHub before publishing.
- Create a uniquely named production backup and rollback directory before cutover.
- Preserve Corona credentials, configuration, uploads, CAPTCHA data, and `.editor-state`.
- Verify the three production article routes, all imported asset hashes, the sitemap, editor authentication, and private-file protections after cutover.
