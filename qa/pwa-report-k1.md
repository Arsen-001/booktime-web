Everything is in place. Не вызывал git (isomorphic-git у main-сессии, мне это не поручали).

## Итог

Роль «приложение для телефона» в `/Users/arsen/WebstormProjects/booking-platform` выполнена — правил только свои файлы.

**Что сделано:**
- `src/app/manifest.ts` (новый) — Next 16 файловая конвенция, отдаёт `/manifest.webmanifest`: имя/подпись из `common.app.name`/`tagline`, `display: standalone`, `theme_color: #4f46e5` и `background_color: #f7f7fb` из палитры «Индиго» (`src/styles/tokens.css`), 4 иконки.
- `public/icons/**` (новые) — сгенерировал PNG из знака `Logo.tsx` (плашка `bg-primary` + буква «A») скриптом на `sharp` (SVG→PNG, уже был в node_modules проекта, ничего не устанавливал): `icon-192/512.png` (purpose `any`, со скруглением), `icon-maskable-192/512.png` (purpose `maskable`, знак в безопасной зоне 80%, без скругления — под маску Android), `apple-touch-icon.png` 180×180. Плюс SVG-исходники рядом.
- `src/app/layout.tsx` — тронул только `metadata`/`viewport`: добавил `manifest`, `icons` (icon + apple), `appleWebApp.capable: true` (standalone-режим на iOS), `viewport.themeColor` раздельно на светлую/тёмную тему. Остальное (шрифты, провайдеры, разметка) не трогал.
- `docs/PWA.md` (новый) — что сделано, как проверить, и отдельно расписал, чего это НЕ включает: service worker/пуши (осознанно не завожу — бэкенда нет, синхронизировать нечего, есть риск закэшировать моковые ответы) и путь к обёртке в магазины (Android — TWA/Bubblewrap поверх готового манифеста; iOS — либо Capacitor, либо остаться на «установке через Safari»); для пушей отдельно описал, что нужно бэкенду и что WebPush на iOS работает только у уже установленного PWA.

**Проверка:**
- `npx tsc --noEmit` и `npx eslint` по `src/app/manifest.ts` и `src/app/layout.tsx` — чисто.
- Дев-сервер поднят только через `scripts/ensure-dev.sh` (был уже жив на :3710, не трогал); `curl /manifest.webmanifest` и `curl -I /icons/icon-512.png` отдают 200; в HTML `<head>` присутствуют `<link rel="manifest">`, `<link rel="apple-touch-icon">`, `<meta name="theme-color">`×2, `<meta name="mobile-web-app-capable" content="yes">`.
- Playwright на 390×844: `pageerror`/консольных ошибок нет, манифест-ссылка на странице корректна.