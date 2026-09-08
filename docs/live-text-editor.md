# Text editing on MTW

Requested scope: edit existing icon and article text (titles, prices, descriptions, passport details, article paragraphs). Preserve URLs, images, publication and layout. Reuse Corona login.

Implementation: authenticated `/corona/admin/content.php`, allowlisted text fields, CSRF tokens, per-record optimistic concurrency, exclusive file lock, private revision backups and atomic JSON replacement. The public MTW PHP renderer reads the same JSON on every request using build-generated templates and bounded content slots. This keeps HTML, metadata, catalog and React data in sync without Cargo or a rebuild after editing. Sites remains a static snapshot.

Verification: store validation/conflict/backup tests, PHP syntax/runtime checks, PHP versus React slot equivalence, existing build/test gates, isolated HTTP save/read and authentication/CSRF tests; preserve production content and rollback artifacts before cutover. Commit and push verified source before deployment.

MTW currently serves the legacy domain with PHP 5.2.17 and Apache 2.2. The editor deliberately uses compatible syntax and the verified operating-system random source (mcrypt MCRYPT_DEV_URANDOM on this host); it does not switch the whole domain's PHP or change the existing credentials. This is compatibility with an inherited runtime, not a claim that the old runtime is supported or fully secure. A hosting/PHP upgrade is separate maintenance.

Build with `npm run build:mtw`. `scripts/deploy-mtw-live.sh` preserves hosting JSON, legacy credentials/uploads and edit backups while replacing application code, keeping the prior document root for rollback. Never deploy a fresh Cargo export over hosting JSON after live editing is enabled; first reconcile/export those edits into the source repository. Static Sites builds remain independent snapshots.

Existing `/corona/admin/` and the old icon/article list entries redirect to the local text editor. A deep edit link is preserved through the existing login. Changing images, slugs, publication/order, adding records and managing unrelated pages are intentionally outside this editor.
