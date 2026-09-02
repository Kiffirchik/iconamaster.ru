# Browser identity deployment

- Deployment date: 2026-09-02 (Europe/Moscow)
- Release commit: `5a5f2db`
- Change: browser title set to `Иконописная мастерская`; thematic SVG favicon added.
- Active document root: `/www/vhosts/27769/iconamaster.ru`
- Preserved previous root: `/www/vhosts/27769/iconamaster.ru.rollback-before-browser-identity-20260902-153214`
- Published `index.html` SHA-256: `f325df44d9b080c177886bf232337971277c12f35e4843602553524d8e83cba9`
- Published `favicon.svg` SHA-256: `6140c4b7f9a7f1334fbd0fe982c1fca040ce3d1b5462968b6042552efc308b52`

## Verified after cutover

- `/` returns HTTP 200.
- `/collection` returns HTTP 200 and reports the title `Иконописная мастерская`.
- `/favicon.svg` returns HTTP 200 and matches the verified MTW build by SHA-256.
- `/corona/admin/index.php` redirects to the Corona login page, which returns HTTP 200.
- The active root retains the existing Corona installation and content assets.

## Rollback procedure

From `/www/vhosts/27769`, preserve the active `iconamaster.ru` directory under a new failure name, then move `iconamaster.ru.rollback-before-browser-identity-20260902-153214` back to `iconamaster.ru`. Do not delete either directory during rollback.
