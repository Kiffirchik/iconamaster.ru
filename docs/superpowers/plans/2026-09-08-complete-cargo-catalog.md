# Complete Cargo catalog migration

> **For agentic workers:** Use subagent-driven-development for disjoint UI and metadata review; controller owns source inventory, import, integration and publication.

**Goal:** Account for every original icon card, migrate distinct public items, and show only description-supported period, purpose and size.

**Architecture:** Preserve existing canonical slugs and immutable local originals. Add a full Cargo source inventory and explicit duplicate decisions; import missing cards into the existing JSON content bundle and source/asset ownership contracts. Customer-facing metadata uses `period`, `purpose`, `size`; provenance and authorship remain prose.

**Tech Stack:** Windows, Node.js, React/Vite static prerender, JSON, MTW SSH/SFTP.

**Spec:** User request dated 2026-09-08: all missing cards; deduplicate; extract period/purpose/size only when stated; ask about ambiguity.

## Constraints

- No generated/repainted icon imagery. Originals retain SHA-256 ownership evidence.
- Do not infer period from subject/style or date of a frame. Do not infer intended use from the saint.
- Same title is not sufficient evidence of a duplicate. Keep every distinct object.
- Keep unpublished Cargo records unpublished unless user explicitly approves.
- Preserve existing descriptions, aliases, Corona and rollback; GitHub push before production.

## Tasks

- [x] Capture all 98 folder entries: 97 cards and one excluded navigation page; source status, exact descriptions and image ownership.
- [x] Compare shared source images/checksums and descriptions; record duplicate and uncertain decisions separately.
- [x] Add missing distinct cards and local originals; preserve existing slugs; add root-relative aliases and independent source fixtures.
- [x] Review all period/purpose/size values against source quotations, retain missing values as empty strings.
- [x] Test/render metadata consistently on detail/home/catalog; no provenance/authorship chips or empty passport values.
- [x] Verify inventory/asset integrity, all unit/setup/static/MTW checks, and desktop/mobile browser behavior.
- [ ] Commit and push verified source, stage MTW release, preserve current production root and CMS files, verify no-cache production pages/images and document rollback.

## Acceptance checks

`npm run verify` must pass; catalog public count must equal distinct approved source records; every source card must have a mapping or explicit exclusion reason. Every published card must own at least one valid local original. New aliases must resolve to canonical cards. Missing metadata must not appear as guessed categories or placeholder passport rows.
