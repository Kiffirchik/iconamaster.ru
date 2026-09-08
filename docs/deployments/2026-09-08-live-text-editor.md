# Local text editor deployment — 2026-09-08

- Application source: `75e959b`, pushed to `origin/codex/iconamaster-production-release` before publication.
- Production: `https://iconamaster.ru` on MTW, existing Apache 2.2 / PHP 5.2 runtime retained.
- Artifact: `iconamaster-live-75e959b-20260908.tar.gz`.
- SHA-256: `e8d5986ea2bbd1d38065dc965f432f4f78100611561f4c9d3bc2a85950601e02`.
- Rollback document root: `/www/vhosts/27769/iconamaster.ru.rollback-before-live-75e959b-20260908`.
- Preserved hosting JSON, Corona login/configuration, uploads and captcha; public text and images not changed by deployment.

## Entry points

- `/corona/admin/content.php?kind=icons`
- `/corona/admin/content.php?kind=articles`
- `/corona/admin/content.php?kind=icons&slug=theotokos-kazanskaya`

Only existing text fields are editable. Saves require the existing authenticated Corona session, a CSRF token and a current per-record revision. Actual changes create a private collection backup and atomically replace JSON. Public HTML, SEO and React snapshot read that JSON immediately; no Cargo export or rebuild is needed.

## Verification completed

- Full `npm run verify` passed, including new template compiler tests and existing static/Sites/MTW checks.
- All PHP files parsed under host PHP 5.2.17.
- Private PHP tests passed: secure random source, no-op byte preservation, forbidden fields, invalid text, saved price/description, stale revision rejection, immutable media/URL preservation, backups, article paragraphs and all 108 live routes.
- PHP and React main markup matched on all 108 live routes before text edits.
- Private loopback HTTP integration passed: unauthenticated rejection, authenticated access, CSRF rejection, actual save and immediate public HTML update, fixture restoration.
- Production no-op save passed through Apache using a temporary Corona-format session; icon JSON hash remained unchanged.
- Production root, catalog, article index, Kazanskaya and Guslitsa pages returned current HTML; private template/backup paths returned 403; anonymous editor redirected to the original login; public JSON revalidates and live HTML is no-store.
- Chrome verification: public card rendered correctly, no browser error/warning logs, editor opened in the user's existing authenticated session; editor tab left open. No live prices or article text changed by testing.

Future releases must preserve hosting content and `.editor-state`. Before using a rollback after real edits, retain current JSON and edit backups so rollback does not discard them. PHP 5.2 is inherited and obsolete; a full hosting/runtime upgrade remains separate maintenance, not part of this text-only editor delivery.
