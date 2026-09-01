# Iconamaster.ru

Фронтенд сайта московской иконописной мастерской: каталог икон, услуги, статьи, видео и контакты. Проект собран на React и Vite и поддерживает локальную разработку, проверку сборки для Sites и подготовку пакета для MTW.

## Быстрый старт в Windows

Поддерживаются Windows 10/11, Windows PowerShell 5.1 и PowerShell 7+. Для работы нужны Git, Node.js `^20.19.0 || >=22.12.0` и npm 10+.

```powershell
git clone https://github.com/Kiffirchik/iconamaster.ru.git
cd iconamaster.ru
.\setup.ps1
```

Обычный запуск проверяет основные инструменты и метаданные проекта, выполняет `npm ci`, проверку переносимости и полный `npm run verify`. Он не устанавливает отсутствующие системные инструменты без явного флага.

Безопасные режимы запуска:

```powershell
# Только диагностика; не устанавливает зависимости
.\setup.ps1 -CheckOnly

# Явно установить недостающие Git/Node.js через winget, затем настроить проект
.\setup.ps1 -InstallPrerequisites

# Дополнительно проверить локальные инструменты для MTW
.\setup.ps1 -CheckOnly -ForDeployment

# Дополнительно проверить закреплённый FFmpeg для миграции
.\setup.ps1 -CheckOnly -ForMigration
```

`-ForDeployment` и `-ForMigration` — только дополнительные локальные проверки. `setup.ps1` не публикует сайт, не подключается к MTW и не запускает миграцию. Сначала изменения должны быть проверены и отправлены в GitHub; публикация на MTW выполняется отдельно.

## Основные команды

```powershell
npm run dev                # локальный Vite-сервер
npm run verify             # полный набор проверок и сборок
npm run build:mtw          # подготовить пакет MTW без публикации
npm run check:portability  # проверить Git-файлы на машинозависимые пути
```

Секреты, SSH-ключи и учётные данные храните вне Git. Подробное описание режимов, prerequisites и диагностики: [Настройка проекта в Windows](docs/windows-setup.md).
