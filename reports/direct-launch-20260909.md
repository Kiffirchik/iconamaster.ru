# Availability and contact placement

Owner-approved update: set only the 85 empty availability values to «В наличии».
Result: 90 in stock, 4 sold, 1 on request; other icon fields unchanged.
The inventory output checksum in the migration report tracks this approved update.

The mural service now puts its tracked consultation links in the introductory header.
Catalog cards display a direct, icon-specific WhatsApp CTA below price and availability.
Existing detail-page contact controls, analytics consent, original images and articles are retained.

Verification includes regression tests, static/content/MTW gates, responsive browser checks,
local instrumented goal clicks, and PHP/React rendering parity on the hosting runtime.
Deployment checks live content against the build and retains the previous release for rollback.
