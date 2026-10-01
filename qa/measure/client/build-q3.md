# Замечания сборки — client (25.09.2026, хранитель сборки, срез q3)

Источник: `npx tsc --noEmit` (весь проект, чисто). `npx eslint src` (весь проект, 0 errors / 26
warnings — 13 из них в разделе client: `src/api/client.ts` и шесть экранов `src/areas/client/**`).
`node scripts/check-tokens.mjs` — раздел client чист (0 находок). Обход `/dev/routes` персонами
owner/client/platform по маршрутам client — 0 плохих ответов, 0 подтверждённых ошибок консоли (см.
`qa/build-health/q3.md`).

## 1. `src/api/client.ts:676,753,1080` — три неиспользуемых `_comment`
- Серьёзность: **minor**
- Где: `src/api/client.ts`, строки 676, 753 (присвоено и не используется), 1080 (параметр не
  используется) — `@typescript-eslint/no-unused-vars`.
- Что не так: имя уже с `_` по конвенции проекта, но правило eslint не настроено видеть этот паттерн
  как «намеренно неиспользуемое» — тот же фундаментный пробел, что уже поднят по разделу online в
  q2/q3 (`qa/requests/build-q3.md`).
- Как исправить: в разделе — ничего; ждёт настройки `argsIgnorePattern`/`varsIgnorePattern: '^_'` в
  `eslint.config.mjs` (фундамент).

## 2. Семь мест с `<img>` вместо `next/image`
- Серьёзность: **minor**
- Где: `src/areas/client/apps/AppsHubScreen.tsx:41`, `NewsScreen.tsx:93`,
  `StoriesGeneratorScreen.tsx:115,321`, `home/HomeScreen.tsx:231`, `home/StoriesRow.tsx:62`,
  `promo/PromoStoriesRow.tsx:23`, `stories/StoryViewScreen.tsx:59` — `@next/next/no-img-element`.
- Что не так: `<img>` вместо `<Image />` из `next/image` — не оптимизируется, медленнее LCP на
  фотографиях мастеров/сторис, которых в этом разделе много (карточки, ленты).
- Как исправить: заменить на `next/image` с явными `width`/`height` (или `fill` в контейнере с
  заданным размером) — стандартная замена, конвенция проекта не запрещает `next/image` нигде.

## 3. `NewsScreen.tsx:33`, `StoriesGeneratorScreen.tsx:167` — неиспользуемый `_`
- Серьёзность: **minor**
- Где: `src/areas/client/apps/NewsScreen.tsx:33`, `src/areas/client/apps/
  StoriesGeneratorScreen.tsx:167` — `@typescript-eslint/no-unused-vars`.
- Что не так: то же самое — параметр с `_`, но правило не настроено под этот паттерн.
- Как исправить: см. пункт 1, фундамент.
