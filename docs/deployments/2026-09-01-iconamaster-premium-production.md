# Iconamaster premium production deployment

- Deployment date: 2026-09-01 (Europe/Moscow)
- Release commit: `a16989673d99b152fb20b7608b5e91039acbccc8`
- Active document root: `/www/vhosts/27769/iconamaster.ru`
- Preserved previous document root: `/www/vhosts/27769/iconamaster.ru.rollback-pre-premium-20260901-190842`
- Previous-site archive: `/www/vhosts/27769/iconamaster.ru.pre-premium-20260901-190842.tar.gz`
- Previous-site archive SHA-256: `1622d03e1a507930bd7cb16316aca1c58058cbeb54a91a7211fc6d3040f164e6`
- Uploaded release archive: `/www/vhosts/27769/iconamaster-production-a169896-20260901-190634.tar.gz`
- Uploaded release SHA-256: `67393b7f7be65604e9aeaf17cc5c1dee3fe1d8c55c96350d00090189e2e7fb3a`

## Verified after cutover

- `/`
- `/collection`
- `/articles`
- `/articles/restoration-murals-cleaning`
- `/articles/georgievsky-church-iconostasis`
- `/icons/facade-george`
- `/contacts`
- legacy route `/IKONY/`
- `/corona/admin/index.php`
- production CSS, JavaScript, icon image, and `content/icons.json` match the release build by SHA-256

## Rollback procedure

From `/www/vhosts/27769`, move the active `iconamaster.ru` directory to a new failure-preservation name, then move `iconamaster.ru.rollback-pre-premium-20260901-190842` back to `iconamaster.ru`. Do not delete either directory or either archive during rollback.
