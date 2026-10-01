# Замечания сборки — notify (25.09.2026, хранитель сборки, срез q3)

## 0. 🔴 `src/mock/slices/notify.ts` — `buildTypes` не импортирован, роняет ВЕСЬ сайт (все разделы, все персоны)
- Серьёзность: **block**
- Где: `src/mock/slices/notify.ts`, строка 127: `types[business.id] = buildTypes(business.id);` —
  внутри функции сидирования (`seed`, используется `seedAreas` → `createSeedData` → `bootDb` из
  `src/mock/db.ts`). Единственное упоминание `buildTypes` выше — строка 62:
  `export { buildTypes } from '@/areas/notify/lib/registry';` — это **ре-экспорт** (`export … from`),
  он делает `buildTypes` доступным для тех, кто импортирует ИЗ `notify.ts`, но НЕ создаёт локальное имя
  внутри самого `notify.ts` — вызов на строке 127 обращается к несуществующей переменной.
- Как воспроизвести: открыть любую страницу (`/`, `/biz/journal`, `/search`, `/biz/online/page`,
  `/biz/billing` — проверено лично, персоны owner/client/platform без разницы, `?demo=` не важен) —
  `bootDb()` падает на сидировании данных ДО того, как определяется бизнес/данные для любого раздела,
  поэтому экран рендерит `EmptyState`/`ErrorState` «Не удалось загрузить — Проверьте соединение и
  попробуйте ещё раз» вместо реального содержимого. В `.dev.log`:
  `⨯ unhandledRejection: ReferenceError: buildTypes is not defined at <unknown> (src/mock/slices/
  notify.ts:87:13) at Array.forEach … at Object.seed (src/mock/slices/notify.ts:86:13) at seedAreas
  (src/mock/db.ts:99:18) at createSeedData (src/mock/db.ts:114:9) at bootDb (src/mock/db.ts:412:28)`.
  Подтверждено дважды: обходом `/dev/routes` (владелец/клиент/платформа) — поймал на `/biz/journal`,
  `/search`, `/biz/online/page`, `/biz/billing` — и прямой проверкой в браузере plus `curl` домашней
  страницы (`/`) — везде текст «Не удалось загрузить».
- Что не так: комментарий над ре-экспортом (строка 60-61) прямо объясняет намерение — «нужна и здесь
  (сид базы)», то есть автор ЗНАЛ, что `buildTypes` нужен локально внутри файла, но написал
  `export { buildTypes } from '…'` вместо `import { buildTypes } from '…'` (или import + повторный
  export отдельной строкой). Скорее всего опечатка при переносе функции в `lib/registry.ts`
  (F-05-043, судя по комментарию).
- Как исправить: добавить `import { buildTypes } from '@/areas/notify/lib/registry';` в блок импортов
  (после строки 17, где уже импортируется `TYPE_REGISTRY` из того же файла) и оставить строку 62
  (`export { buildTypes } from …`) как есть — она нужна для `liveLog.test.ts` (по тому же комментарию)
  и это отдельный, самостоятельный re-export, соседство с обычным import не конфликтует.

---

Источник остального: `npx tsc --noEmit` и `npx eslint src` (весь проект) — раздел notify чист вне
пункта 0 (0 ошибок типов, 0 warnings — сама ошибка выше не ловится ни tsc, ни eslint, потому что
`buildTypes` существует как экспортируемое имя модуля, просто не как локальная переменная; типизация
разрешает `export … from` синтаксис, ошибка чисто рантаймовая). `node scripts/check-tokens.mjs` (весь
проект, exit 1, найдено 12) — 1 находка в разделе notify (пункт 1 ниже).

## 1. `src/areas/notify/ChannelsTab.tsx:57` — `text-white` вместо токена
- Серьёзность: **minor**
- Где: `src/areas/notify/ChannelsTab.tsx`, строка 57:
  `'grid size-5 shrink-0 place-items-center rounded-full bg-success text-white'`.
- Что не так: `check-tokens.mjs` ловит класс из Tailwind-палитры (`text-white`) рядом с уже правильным
  токеном `bg-success` в той же строке — на бейдже/иконке успеха текст должен быть цветом токена
  (обычно у `bg-success` есть парный `text-on-success` или аналог в `tokens.css`), а не голым
  Tailwind-цветом.
- Как исправить: проверить `src/styles/tokens.css` на предмет `text-on-success`/`fg-on-success` (или
  как называется парный токен для текста поверх `bg-success` у соседних компонентов) и заменить
  `text-white` на него; если такого токена ещё нет — это уже общий вопрос дизайн-системы, не только
  notify (стоит свериться с хранителем дизайна, не заводить свой цвет в одиночку).
