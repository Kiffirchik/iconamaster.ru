# September 2026 article import

Owner-supplied DOCX files were imported into the existing article schema without changing the design or image pixels.

| Document | Canonical article | Decision |
| --- | --- | --- |
| История меднолитых икон.docx | `/articles/history-of-cast-icons` | New article, all paragraphs and 8 illustrations |
| Литые Кресты.docx | `/articles/cast-crosses` | New article, all paragraphs, captions and 12 illustrations, including Word table images |
| Иконопись в Русском Пантелеймоновом монастыре.docx | `/articles/panteleimon-monastery-icons` | Supplement existing article; owner approved no duplicate |

The monastery article retains its original five illustrations and existing prose, including the historical period and researcher attribution. Two missing text fragments and three illustrations were added. Three other DOCX photographs were byte-identical to existing assets and reused, not copied again.

`reports/docx-import.json` records source document hashes and the ownership, original ZIP member, size and SHA-256 of all 23 added assets. DOCX body paragraphs are processed in XML order, including paragraphs inside tables. Two short catalogue summaries are editorial introductions, not quotations from the documents. Source references for the new articles are internal `docx:` metadata, not fabricated publication URLs.

## Reproducing this bounded import

Prerequisites: Python 3.10+ with `lxml` and `Pillow`; the original three documents; and the pre-import live `articles.json` baseline. The script resolves the repository from its own location and takes paths as arguments, with no machine-specific installation paths:

```text
python scripts/import-docx-articles.py --incoming <documents-directory> --baseline <pre-import-live-articles.json>
npm run verify
```

This is a one-batch importer, not a general CMS importer. It expects the pre-import baseline and must not be run against already-imported or subsequently edited articles. Do not rerun the historical Cargo editorial migration over live content: that legacy importer does not preserve later DOCX additions or text-editor changes.

Hosting JSON is authoritative. This batch reconciles existing live edits to the Guslitsa article and mural-cleaning article before importing. Deployment must recheck the baseline hashes immediately before cutover and preserve `.editor-state`, Corona authentication, configuration and uploads. Future edits to the imported articles use the existing Corona text editor.

All new image bytes are unchanged. Document tables were verified through XML and image contact sheets; desktop and mobile article rendering were checked in the browser. No Word/PDF layout recreation is delivered.
