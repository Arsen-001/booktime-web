# Замечания сборки — client (25.09.2026, хранитель сборки, срез q1)

Источник: `node scripts/check-tokens.mjs` (проект целиком, exit 1). `npx tsc --noEmit` и `npx eslint src`
для раздела чисты. Обход `/dev/routes` персонами owner/client/platform по маршрутам раздела (`/`,
`/search`, `/bookings`, `/favorites`, `/profile`, `/biz/apps`) — 0 плохих ответов, 0 ошибок консоли.

## 1. `SlotPicker.tsx:76` — сырой цвет `text-white` вместо токена
- Серьёзность: **major**
- Где: `src/areas/client/book/SlotPicker.tsx`, строка 76: класс `'border-primary bg-primary text-white'`
- Что не так: `text-white` — палитра Tailwind напрямую, а не токен из `src/styles/tokens.css` (правило
  §0/CONVENTIONS «Единообразие. Только компоненты src/ui и токены»); `check-tokens.mjs` ловит это как
  нарушение (`tailwind-palette`). В тёмной теме такой цвет не подстроится вместе с остальной палитрой.
- Как исправить: заменить `text-white` на соответствующий токен (например `text-on-primary` /
  `text-inverse` — проверьте, какой существует в `tokens.css` для текста поверх `bg-primary`, у соседних
  кнопок с primary-фоном такой уже используется — взять оттуда тот же класс).

✅ исправлено (b03): `text-white` → `text-primary-contrast` в `SlotPicker.tsx:76`; `check-tokens.mjs --area client` теперь чист.
