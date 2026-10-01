# Замечания сборки — notify (25.09.2026, хранитель сборки, срез q4)

Источник: `npx tsc --noEmit` (весь проект, 0 ошибок на момент сдачи — во время среза на файле
`src/areas/notify/channels/CatalogScreen.tsx` несколько раз ловились ошибки типов (`catalog.partner*`
ключи не в `NamespacedMessageKeys<Messages, "notify">`, `Cannot find name
'simulatePartnerConfirmBooking'`), но не подтвердились дважды подряд — файл живо правился, к финальному
прогону чисто; см. `qa/build-health/q4.md`, п.1, если ошибка вернётся на следующем срезе — стоит
разобрать её отдельно, это выглядело как недобавленные ключи в `messages/*/notify.json`, а не как флейк).
`npx eslint src` — раздел notify чист (0 находок). `node scripts/check-tokens.mjs` — 1 находка, повтор с
q3. Обход `/dev/routes` — финальный прогон 0 плохих ответов, 0 ошибок консоли на маршрутах notify (см.
`qa/build-health/q4.md`).

## 1. `check-tokens`: `text-white` рядом с токеном (повтор с q3, не исправлено)
- Серьёзность: **minor**
- Где: `src/areas/notify/ChannelsTab.tsx:57` —
  `'grid size-5 shrink-0 place-items-center rounded-full bg-success text-white'`.
- Что не так: `bg-success` — токен, `text-white` — стандартный класс палитры Tailwind, которой в
  проекте нет (правило §0.3: только токены из `src/styles/tokens.css`). Та же находка была в q3
  (`qa/measure/notify/build-q3.md` тогда — пункт 1), строка не менялась.
- Как исправить: заменить `text-white` на токен текста «на цветной плашке» — судя по соседям в
  `src/ui` (например `Badge`/значки статуса), обычно это `text-on-accent` или аналогичный класс из
  `tokens.css`; если такого токена ещё нет — не заводить свой, а спросить в `qa/requests/build-q4.md`.
