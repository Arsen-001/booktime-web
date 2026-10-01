# Замечания сборки — client (25.09.2026, хранитель сборки, срез q4)

Источник: `npx eslint src` (весь проект, 0 errors / 29 warnings на финальном снимке — 13 из них в
разделе client, число и места не менялись весь срез). `node scripts/check-tokens.mjs` — раздел client:
4 находки (новое с q3, тогда было 0). Обход `/dev/routes` персонами owner/client/platform по маршрутам
client — финальный прогон 0 плохих ответов, 0 ошибок консоли (см. `qa/build-health/q4.md`).

## 1. `src/api/client.ts:710,787,1103` — три неиспользуемых `_comment`
- Серьёзность: **minor**
- Где: `src/api/client.ts`, строки 710, 787 (присвоено и не используется), 1103 (параметр не
  используется) — `@typescript-eslint/no-unused-vars`.
- Что не так: имя уже с `_` по конвенции проекта «неиспользуемое — с подчёркивания», но правило eslint
  не настроено считать этот паттерн намеренным — тот же фундаментный пробел из q2/q3.
- Как исправить: в разделе ничего делать не нужно, ждёт `argsIgnorePattern`/`varsIgnorePattern: '^_'`
  в `eslint.config.mjs` — повтор в `qa/requests/build-q4.md`, пункт 1.

## 2. Семь мест с `<img>` вместо `next/image`
- Серьёзность: **minor**
- Где: `src/areas/client/apps/AppsHubScreen.tsx:63`, `NewsScreen.tsx:93`,
  `StoriesGeneratorScreen.tsx:115,310`, `home/HomeScreen.tsx:233`, `home/StoriesRow.tsx:62`,
  `promo/PromoStoriesRow.tsx:23`, `stories/StoryViewScreen.tsx:59` — `@next/next/no-img-element`.
- Что не так: `<img>` вместо `<Image />` — не оптимизируется, медленнее LCP на фотографиях мастеров и
  сторис, которых в разделе много (повтор с q3, номера строк почти не сдвинулись).
- Как исправить: заменить на `next/image` с явными `width`/`height` (или `fill` в контейнере
  фиксированного размера).

## 3. `NewsScreen.tsx:33`, `StoriesGeneratorScreen.tsx:167` — неиспользуемый `_`
- Серьёзность: **minor**
- Где: `src/areas/client/apps/NewsScreen.tsx:33`, `src/areas/client/apps/
  StoriesGeneratorScreen.tsx:167` — `@typescript-eslint/no-unused-vars`.
- Что не так: см. пункт 1 — тот же пробел eslint-конфига.
- Как исправить: см. пункт 1, фундамент.

## 4. `check-tokens`: два произвольных цвета в `ServicesAppScreen.tsx` (новое с q3)
- Серьёзность: **major**
- Где: `src/areas/client/apps/ServicesAppScreen.tsx:493,505` —
  `className="size-4 accent-[color:var(--color-primary)]"` на радио-инпутах выбора пакета.
- Что не так: `accent-[color:…]` — произвольное Tailwind-значение цвета, а не класс токена. По правилу
  §0.3 в компонентах допускаются только токены; здесь цвет технически ссылается на CSS-переменную
  токена (`--color-primary`), но `check-tokens.mjs` этого не различает — форма записи (`accent-[color:…]`)
  сама по себе флагуется как произвольный цвет, а не факт неправильного значения.
- Как исправить: если в `src/ui`/`tailwind.config` уже есть готовый класс `accent-primary` (или похожий
  токен-класс для `accent-color`) — использовать его; если нет — либо завести такой класс в фундаменте
  (запрос — `qa/requests/build-q4.md`), либо, если это единственное законное место, где нужен именно
  `accent-[color:var(--…)]` через CSS-переменную токена (не сырое значение), пометить строку
  `// tokens-ok: цвет — ссылка на токен --color-primary, не сырое значение`.

## 5. `check-tokens`: `#ffffff` в SVG data-URI (`src/mock/slices/client.ts:46,47`, новое с q3)
- Серьёзность: **minor**
- Где: `src/mock/slices/client.ts:46,47` — декоративный SVG (`<circle … fill="#ffffff" opacity="0.12"/>`)
  зашит строкой в моковые данные (фон промо-карточки).
- Что не так: формально сырой hex, но это декоративный узор ВНУТРИ данных (как цвет лака в других
  срезах, которые `check-tokens.mjs` явно исключает только для `src/mock/seed/**`, а `src/mock/slices/**`
  не исключён).
- Как исправить: похоже на легитимный случай «цвет из данных» — пометить обе строки
  `// tokens-ok: декоративный SVG-паттерн карточки, не UI-цвет` (комментарий на той же строке или
  соседней, `check-tokens.mjs` пропускает строку с `tokens-ok`).
