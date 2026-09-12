# Expandable icon details — 2026-09-12

- Source `e8edc8bfba2025aee62f2a085e1ae8589aab04df` pushed to `origin/codex/icon-more-details-20260912` before MTW publication.
- Payload `iconamaster-more-details-20260912.tar.gz`, SHA-256 `55528561f5bf44afcddd51a438ed59dd06f1d0baa74376e3cc174b796ce011bb`.
- Previous root: `/www/vhosts/27769/iconamaster.ru.rollback-before-more-details-20260912`.
- Full backup: `/www/vhosts/27769/iconamaster.ru.before-more-details-20260912.tar.gz`, SHA-256 `dbd5d99605b3cfd819b9fcca077c5f6d83fa6d74c5444d6cb4415eaa1e819863`.

Migration added only the missing `moreDetails` key with an empty string to 95 icons under the existing editor lock. Current live JSON, Corona credentials, images, discounts and `.editor-state` were preserved. Other JSON files were byte-compared with their live originals. No demonstration text was published.

Icons SHA-256 before: `e591c88fdc478d3b93a18b389f07ff083e5c978f36f960ed4c672939a25e558f`; after: `c8afaa9aeff95242943bc4231efc3bb0d4269584a74a2ada04b17621ca8df443`.

## Verification

- Red/green test for disclosure placement, initial closed state, blank values, escaped HTML and unchanged collection tiles.
- Full verify passed: 34 setup, 217 unit, 6 static, 6 Sites compatibility and 4 MTW tests. Final MTW rebuild and targeted test passed after Unicode whitespace parity refinement. No Sites publication.
- PHP 5.2 tests passed for multiline editing, persistence, no-op preservation, clearing, safe rendering and whitespace-only values including U+FEFF. PHP/React parity checked across 116 routes.
- Private loopback HTTP test passed for login protection, CSRF, saving additional text and discounted prices, immediate safe response and fixture restoration.
- Private migration tested against copied live data: 95 additions; second run 0 additions. All existing fields preserved.
- Desktop/390px browser check: click and Enter expand/collapse text, paragraph breaks retained, no horizontal overflow. Native details/summary needs no separate network request.
- Production smoke: homepage, collection, icon detail and articles return 200 with working bundles; both discount attributes and new field present on all 95 icons; private paths denied; Corona authentication retained.
- Production editor visibly contains the multiline field. Unchanged form save succeeded and retained the post-migration icon checksum.

Before rollback preserve the newest live `content/*.json` and `.editor-state`. Retain the current root under another name, then restore the saved root above; keep post-publication edits instead of overwriting them with an older snapshot. Administration: [Подробнее об иконе](../icon-more-details.md).
