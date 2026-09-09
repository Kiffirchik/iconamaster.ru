# Direct readiness — 2026-09-09

Published to https://iconamaster.ru from pushed application commit `589a034` on `codex/direct-readiness-20260909`.

- Added `/privacy`, persistent opt-in/opt-out for Metrica, footer settings, no unconditional tracking pixel. Webvisor was off in the Metrica account and is now explicitly false in code.
- Moved icon price, current availability and WhatsApp CTA before description, including on mobile. Unknown availability stays unknown. New `icon-description` PHP slot preserves live editing.
- Existing public content was not changed. All seven JSON hashes matched before/after; editor revisions and credentials preserved.
- 203 unit tests, 6 static-build checks, 4 MTW checks passed. PHP 5.2 syntax and PHP/React main-markup parity passed for all 110 live routes; additional availability/escaping checks passed.
- Production `/privacy` and icon summary verified. Sitemap 121 URLs at publication, before the concurrent article batch.

Created exact-match event goals in counter 112185835:

| Event | Goal ID |
|---|---|
| contact_whatsapp | 610828863 |
| contact_phone | 610832194 |
| contact_email | 610833655 |
| murals_consultation | 610835779 |

All four dispatched on actual link clicks, confirmed by Metrica debug logs. WhatsApp, phone and murals already appeared in account report; email account-report arrival not separately confirmed at handoff. Test visits: `from=codex_direct_check_20260909`. Murals CTA also sends contact_whatsapp: these are overlapping microconversions, not two independent leads. No messages sent or calls placed.

Operational recovery information is kept only in the local project report.

Concurrent article task was notified to integrate `589a034` before its next deployment. Its source commit `63a2397` adds articles independently. Preserve both sets of changes; adjust static-route expectations for the additional `/privacy` route.
