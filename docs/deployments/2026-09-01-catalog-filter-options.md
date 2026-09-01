# Catalog filter options deployment

- Deployment date: 2026-09-01 (Europe/Moscow)
- Release commit: `025501927f8e9b8fd8df0fa866cc9ccb2bad8535`
- Change: blank values are excluded from all three catalog filter option lists.
- Active document root: `/www/vhosts/27769/iconamaster.ru`
- Preserved previous root: `/www/vhosts/27769/iconamaster.ru.rollback-before-filter-options-20260901-202311`
- Previous-site archive: `/www/vhosts/27769/iconamaster.ru.before-filter-options-20260901-202311.tar.gz`
- Previous-site archive SHA-256: `7846a662339a586c1442b1dbc771098ad41460cc4f981d9e51b6f0ea88094445`
- Release archive: `/www/vhosts/27769/iconamaster-filter-options-0255019-20260901-202311.tar.gz`
- Release archive SHA-256: `27631ef7adfb1ef7d670a975587230255318f073907e9c0ca80179ccbd76ae9b`

## Verified after cutover

- `Тип иконы`: no blank option
- `Период`: no blank option
- `Наличие`: no blank option
- `/corona/admin/index.php` reaches the Corona login page
- production JavaScript matches the verified MTW build by SHA-256

## Rollback procedure

From `/www/vhosts/27769`, preserve the active `iconamaster.ru` directory under a new failure name, then move `iconamaster.ru.rollback-before-filter-options-20260901-202311` back to `iconamaster.ru`. Do not delete either directory or either archive during rollback.
