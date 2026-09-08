# Full Cargo catalog, 2026-09-08

The original folder contains 97 icon-card records, not just the first lazy-loaded 50. One record is hidden. One published Feodorovskaya duplicate is merged with the existing canonical card, with the owner's confirmed price of 150,000 RUB. The resulting public bundle contains 95 cards. Same titles alone never trigger a merge.

## Sources and decisions

- `scripts/data/cargo-catalog-20260908.json`: complete captured public Cargo API records, original titles/descriptions, publication state and owned image URLs.
- `scripts/data/cargo-card-ids.json`: observed folder inventory, excluding the separate navigation page.
- `scripts/data/cargo-reviewed-metadata.json`: period/purpose/size values, each backed by a verbatim title or description quotation. Empty means no reliable statement in the source.
- `scripts/data/cargo-duplicate-decisions.json`: reviewed duplicates, unusable Cargo uploads and explicit owner corrections. The Smolenskaya source price typo is corrected to 20,000 RUB by owner confirmation.
- `reports/cargo-complete-migration.json`: full source-to-canonical accounting, exclusions and coverage.

Authorship and provenance remain in the original prose, not separate customer-facing attributes. Dates of depicted events, historical prototypes, styles, frames or metal covers are not used to date the painted object. No date or purpose is inferred from appearance.

Two possible duplicate pairs remain separate pending owner identification: Cargo 9007316/9153754 and 9007346/9160289. For Cargo 9160368 the owner corrected the kiot to 64 × 54 cm and price to 200,000 RUB; the icon remains 50 × 40 cm. This correction is recorded separately from the immutable original evidence.

## Repeatable import on Windows

After the documented Windows setup, run from the project root:

```powershell
npm run migrate:icons -- --offline
npm run verify
```

The default `migrate:icons` and explicit `migrate:icons:complete` commands now use the complete inventory. An offline rerun uses the committed original images and reviewed duplicate-photo mappings; it needs no ignored temporary download cache or machine-specific paths. Canonical URLs and retained original bytes remain unchanged. This is a reviewed one-time migration replay, not an automatic synchronizer for subsequent CMS edits: review the diff before publishing.

The legacy `scripts/migrate-icons.mjs` remains as a parser library and historical migration implementation. Do not run its old first-50 CLI directly against the complete mapping.

For an intentional new source capture, inspect the current Cargo inventory first. `scripts/capture-cargo-catalog.mjs` consumes the raw capture and `scripts/download-cargo-originals.mjs` downloads missing page-owned originals into ignored `tmp/` paths. Review new visibility, duplicate decisions, metadata and ownership before importing. Do not overwrite the dated snapshot merely to refresh content without preserving its audit history.

## Publication

The 65 new photographs have separate MTW JPEG derivatives in `release/optimized-assets/assets/icons`, capped at 1600 pixels without upscaling, cropping or color transforms. Their audit is in `reports/cargo-deployment-images.json`. All 144 immutable originals remain in `public/assets/icons`; the 247 pre-existing deployment derivatives are unchanged. Normal builds use committed derivatives and need no Python. To verify this optional image-processing step, use Python 3.9+ with Pillow (batch produced with Pillow 12.3.0):

```powershell
python scripts/prepare-cargo-deployment-images.py --verify-only
```

The derivative script is create-only and refuses to overwrite an existing batch. It is not part of dependency setup or ordinary content editing.

Use the established MTW static build, not Sites publication. Push the exact verified source to GitHub before publishing. Preserve the active production root as a rollback directory and preserve `corona`, `config.php`, `uploads` and `captcha`. Check that production content has not changed since the local baseline before replacing it. All 95 icon routes must be present in static output and the sitemap; every published card must have at least one valid local image.
