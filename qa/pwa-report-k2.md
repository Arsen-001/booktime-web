Cleaned up, no leftover files in the project tree.

Отчёт по PWA-заданию (приложение для телефона):

**Обнаружено:** всё требуемое уже сделано и лежит в дереве — не пустая правка, а завершённая работа, датированная 25.09.2026 (сегодня). Я перепроверил и подтвердил каждый пункт вместо повторного создания:

- `/Users/arsen/WebstormProjects/booking-platform/src/app/manifest.ts` — файловая конвенция Next 16, отдаёт `/manifest.webmanifest`. Имя/подпись берутся из `common.app.name`/`common.app.tagline` (сейчас «Azat»), `display: 'standalone'`, `theme_color: '#4f46e5'` (палитра Индиго, `--primary`), `background_color: '#f7f7fb'` (`--bg` светлой темы), иконки `any` (192/512) + `maskable` (192/512).
- `/Users/arsen/WebstormProjects/booking-platform/public/icons/` — `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (плюс исходные `icon.svg`/`icon-maskable.svg`), сгенерированы из знака `Logo.tsx` (плашка `bg-primary` + буква «A»).
- `/Users/arsen/WebstormProjects/booking-platform/src/app/layout.tsx` — тронуты только `metadata`/`viewport`: `manifest`, `icons`, `appleWebApp.capable`, раздельный `viewport.themeColor` на светлую/тёмную тему, `viewportFit: 'cover'` (безопасные зоны) уже стоял раньше.
- `/Users/arsen/WebstormProjects/booking-platform/docs/PWA.md` — описывает сделанное и отдельно: что понадобится для пуш-уведомлений (backend для `PushSubscription`, service worker, VAPID, ограничение iOS — пуш только у установленного PWA) и для обёртки в магазины (Android — TWA/Bubblewrap, iOS — только Capacitor, оба требуют реальный домен). Service worker и пуши сознательно не подключены — верно по правилу «без бэкенда рано».

**Проверено в этой сессии (не только чтением файлов):**
- `curl http://localhost:3710/manifest.webmanifest` — валидный JSON, все поля на месте.
- Иконки отдаются `200 OK` со статики.
- `tsc --noEmit` и `eslint` по `manifest.ts` и `layout.tsx` — без ошибок.
- Playwright на 390×844: `<link rel="manifest">`, `<meta name="theme-color">` (обе темы), `<link rel="apple-touch-icon">`, `<meta name="mobile-web-app-capable" content="yes">` (актуальный тег Next 16 вместо устаревшего `apple-mobile-web-app-capable`) — всё присутствует, консоль и page-errors пустые.

Правок не потребовалось — задание было уже полностью и корректно выполнено; git не вызывал, второй dev-сервер/build не запускал, работал только с уже поднятым сервером на 3710.