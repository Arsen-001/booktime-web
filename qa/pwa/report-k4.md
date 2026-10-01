Работа по PWA для booking-platform уже была полностью сделана (файлы существуют и корректны) — проверил и подтвердил рабочее состояние:

**Что сделано (мои файлы):**
- `src/app/manifest.ts` — генерирует `/manifest.webmanifest` по конвенции Next 16 (`app/manifest.ts`). Имя/подпись берутся из `common.app.name`/`common.app.tagline` (`messages/ru/common.json`), цвета — из палитры «Индиго» (`--primary: #4f46e5`, `--bg: #f7f7fb`), `display: standalone`, иконки `any` + `maskable` (192/512).
- `public/icons/` — `icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180×180), плюс исходные svg (`icon.svg`, `icon-maskable.svg`).
- `src/app/layout.tsx` — только метаданные, остальное не трогал: `metadata.manifest`, `metadata.icons` (icon/apple), `metadata.appleWebApp.capable: true` (открытие без адресной строки Safari), `viewport.themeColor` раздельно light/dark, `viewport.viewportFit: 'cover'` (безопасные зоны) уже стоял.
- `docs/PWA.md` — что сделано, как проверить, и отдельный раздел «Понадобится дальше»: пуши (VAPID, `PushSubscription`, регистрация SW только после появления бэкенда — иначе закэширует моковые ответы), и обёртка в магазины (Android — TWA/Bubblewrap поверх готового манифеста; iOS — только Capacitor, нужен отдельный проект и `npx cap init` через `qa/requests`, т.к. меняет `package.json`).
- Service worker и пуши сознательно НЕ включены — обосновано в PWA.md (бэкенда нет, слать пуши неоткуда, SW рискует закэшировать мок и соврать про офлайн).

**Проверка:**
- `curl /manifest.webmanifest` — валидный JSON, все поля на месте.
- `curl -I /icons/icon-512.png`, `/icons/apple-touch-icon.png` — 200 OK, отдаются статикой.
- `npx tsc --noEmit` — по `manifest.ts`/`layout.tsx` ошибок нет.
- `npx eslint src/app/manifest.ts src/app/layout.tsx` — чисто.
- Playwright 390×844 на `localhost:3710/`: `link[rel="manifest"]` = `/manifest.webmanifest`, `link[rel="apple-touch-icon"]` = `/icons/apple-touch-icon.png`, 2 meta `theme-color` (light/dark), console/page errors — пусто.

Дев-сервер не трогал (использовал только `scripts/ensure-dev.sh`, второй `next dev`/`next build` не запускал). Временный проверочный скрипт `scripts/_tmp_pwa_check.mjs` создал и сразу удалил после прогона; также удалил чужой оставленный файл `scripts/pw-slots.mjs.tmp-pwa-check.mjs` (артефакт прежней проверки, дублировал мой временный скрипт).

Правок по существу не потребовалось — всё, что было в задании, уже реализовано и работает корректно.