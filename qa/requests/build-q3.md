# Замечания сборки — фундамент (25.09.2026, хранитель сборки, срез q3)

Источник: `npx tsc --noEmit` (весь проект, 0 ошибок), `npx eslint src` (весь проект, 0 errors /
26 warnings — все 26 внутри разделов, ни одного в файлах фундамента), `node scripts/check-tokens.mjs`
(весь проект, exit 1, найдено 12 — 4 из них в файлах фундамента). Обход `/dev/routes` персонами
owner/client/platform — см. `qa/build-health/q3.md`, фундаментных файлов среди причин нет.

## 1. Повтор с q2: `argsIgnorePattern`/`varsIgnorePattern: '^_'` всё ещё не настроен в `eslint.config.mjs`
- Серьёзность: **major**
- Где: `eslint.config.mjs` (правило `@typescript-eslint/no-unused-vars`).
- Что не так: третий срез подряд разделы пишут код по конвенции проекта «неиспользуемое — с `_`»
  (`src/api/client.ts`, `src/api/online.ts`, `WidgetScreen.tsx`, `NewsScreen.tsx`,
  `StoriesGeneratorScreen.tsx` и т.д. — 20 из 26 текущих warning'ов ровно этого вида), а eslint всё
  равно светит warning на каждое такое место, потому что правило не знает про `^_`. В q2 это уже было
  поднято (`qa/requests/build-q2.md` не содержал этот пункт явно, но `qa/measure/online/build-q2.md`
  пункт 1 указывал на него как «подниму хранителю фундамента отдельно») — судя по текущему прогону,
  настройка так и не сделана, а список мест только вырос (был 1 файл на 7 полей в q2, сейчас минимум
  5 файлов на 20 мест).
- Как исправить: в `eslint.config.mjs`, в блоке правил `@typescript-eslint/no-unused-vars`, добавить
  `{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }` (обычная
  форма конфигурации этого правила) — уберёт все 20 подобных warning'ов разом, без правки ни одного
  раздела.

> **Ядро k4 (25.09):** ❌ не мой файл: `eslint.config.mjs` не входит в файлы хранителя ядра (конфиги — главный). Правка — одна строка `{ argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }`, передана в отчёте `qa/core/report-k4.md`.

## 2–3. `src/app/layout.tsx:50-51` — сырые цвета в `themeColor` (повтор с q2, не сделано)
- Серьёзность: **major**
- Где: `src/app/layout.tsx`, строки 50 и 51: `'#f7f7fb'` (light), `'#0f0f1a'` (dark).
- Что не так: то же самое, что в q2 (`qa/requests/build-q2.md`, пункт 1) — значения не изменились,
  замечание не отмечено ни исправленным, ни отложенным.
- Как исправить: см. `qa/requests/build-q2.md` — взять значения токенов фона light/dark из
  `src/styles/tokens.css` (буквально, с комментарием откуда) или пометить `tokens-ok` как системное
  поле метаданных.

> **Ядро k4 (25.09):** ❌ не мой файл: `src/app/layout.tsx` — помощник «приложение для телефона». Значения уже одной копией — `THEME_META` из `src/config/theme-meta.ts` (k3); ему — подставить.

## 4–5. `src/app/manifest.ts:21-22` — сырые цвета в PWA-манифесте (повтор с q2, не сделано)
- Серьёзность: **major**
- Где: `src/app/manifest.ts`, строка 21: `background_color: '#f7f7fb'`, строка 22:
  `theme_color: '#4f46e5'`.
- Что не так: то же самое, что в q2 (`qa/requests/build-q2.md`, пункт 2) — не изменилось.
- Как исправить: см. `qa/requests/build-q2.md` — свести к одной константе с `layout.tsx` (пункт 2-3
  выше) либо `tokens-ok`.

> **Ядро k4 (25.09):** ❌ не мой файл: `src/app/manifest.ts` — помощник «приложение для телефона»; `THEME_META.lightBackground` / `THEME_META.primary` готовы (k3).
