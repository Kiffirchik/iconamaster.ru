# Homepage section order deployment

- Deployment date: 2026-09-01 (Europe/Moscow)
- Release commit: `36a968245a69ed63882285cd755388763bc8c740`
- Change: `Избранные материалы` now appears before `Новые поступления` on the homepage.
- Active document root: `/www/vhosts/27769/iconamaster.ru`
- Preserved previous premium root: `/www/vhosts/27769/iconamaster.ru.rollback-premium-before-home-order-20260901-195243`
- Previous premium archive: `/www/vhosts/27769/iconamaster.ru.premium-before-home-order-20260901-195243.tar.gz`
- Previous premium archive SHA-256: `c4cdc91600b6939be21cae18dfcae941874ca74b1f006e8043372d7a752f79e9`
- Release archive: `/www/vhosts/27769/iconamaster-home-order-36a9682-20260901-195243.tar.gz`
- Release archive SHA-256: `2b4618fa25f9ad3cc3782400f24f722457c84a4fbbd61c2e1364bb874a5b8486`

The earlier pre-premium rollback directory and archive remain on the server. During rollback, preserve the current active directory under a new failure name before restoring the previous premium root.
