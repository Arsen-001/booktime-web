# loyalty · g1-1-fix2 (25.09.2026)

Починка дефектов, найденных измерителем на доделке g1-1 (список функций g1-1 — в задании).

## Итог по 5 дефектам измерителя

- **F-06-175 (block), F-06-176 (block, права), F-06-177 (block)** — НЕ мои пути. Подтвердил заново: в
  `src/config/permissions.ts` по-прежнему нет 8 ключей «Лояльность»/сетевых прав, в разделе `staff` по-прежнему
  нет экрана «Доступ» с этими галочками (`grep -rln "F-06-175\|F-06-176\|F-06-177" src/` — пусто вне
  `src/areas/loyalty/lib/accountRights.ts`, который уже читает то, что можно читать — тонкие права `clients`).
  Свежая просьба зафиксирована в `qa/requests/loyalty.md` (раздел `g1-1-fix2`) с точным списком полей и путём
  хранения, который заведу сам, как только `staff` даст экран-хозяин. Не строю сам — это путь `staff`, а
  §1 CONVENTIONS запрещает править чужие пути.
- **F-06-030 (major)** — два независимых дефекта под одним F-id:
  1. **Квота localStorage** (роняет «переживает перезагрузку» для ЛЮБОЙ мутации раздела, не только удаления
     типа карты) — фундаментный баг `src/mock/db.ts`, не мои пути. Перепроверил сегодня: `QuotaExceededError`
     всё ещё кидается (лог виден в `console.warnings` на каждой странице `/biz/loyalty/*` через measure.mjs).
     Повторно зафиксировано в `qa/requests/loyalty.md`.
  2. **Дизайн-дефект «удаление вместо архива»** (questions-q4 В-40, свой путь) — ПОЧИНЕНО: добавил
     `CardType.archived`, `setCardTypeArchived()`, `deleteCardType` теперь отказывает `validation`, если у типа
     есть выданные карты, `issueCard` отказывает для архивного типа. `CardTypesScreen.tsx` — вкладки
     «Активные»/«Архивные» (паттерн `MembershipTypesScreen.tsx`), восстановление из списка.
     `CardTypeFormScreen.tsx` — «Удалить» скрыта при наличии выданных карт (вместо неё подсказка с числом),
     «Архивировать»/«Вернуть из архива» — всегда.
- **F-06-149 (major)** — тот же корень, что квота у F-06-030 (не мои пути); повторно подтвердил и
  зафиксировал.

## Дополнительно из qa/measure/loyalty (§0.1, вне b*-m*/g*-m*)

Прочитал `demo-q4.md` и `questions-q4.md` (единственные файлы вне списка исключений — остальные
`ux-*`/`speed-*`/`arch-*`/`core-rules*`/`state-*`/`decision-*`/`recheck-*`/`e2e-*`/`text-*`/`a11y-*`/
`build-*`/`onboarding-*`/`ux-best-*` уже разбирались раньше и туда не заходил):

- **minor** (`demo-q4.md`) — «сети» в подзаголовке `/biz/loyalty/cards` у бизнеса с одним адресом —
  исправлено: подзаголовок теперь по персоне (`cards.subtitle`/`subtitleSingle`/`subtitleIndividual`).
- **minor** (`demo-q4.md`) — служебная строка на хабе `/biz/loyalty` для не-сетевых персон — исправлено:
  строка теперь показывается только персоне `network`.
- **major** (`questions-q4.md`, В-40 «удаление типа карты») — исправлено вместе с F-06-030 выше.

## Файлы

- `src/domain/loyalty.ts` — `CardType.archived`
- `src/api/loyalty.ts` — `setCardTypeArchived`, `deleteCardType`/`issueCard` учитывают архив/выданные карты
- `src/areas/loyalty/CardTypesScreen.tsx` — вкладки «Активные/Архивные»
- `src/areas/loyalty/card-types/CardTypeFormScreen.tsx` — кнопка «Архивировать», условная «Удалить»
- `src/areas/loyalty/CardsScreen.tsx`, `src/areas/loyalty/LoyaltyHubScreen.tsx` — персонозависимые подписи
- `messages/ru/loyalty.json`, `messages/en/loyalty.json` — новые ключи (архив, подписи)
- `qa/requests/loyalty.md` — свежая просьба (g1-1-fix2) к `staff` и по квоте `mock/db.ts`
- `qa/measure/loyalty/demo-q4.md`, `qa/measure/loyalty/questions-q4.md` — отмечены ✅ исправлено

## Проверки

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/loyalty.tsbuildinfo` — 0 ошибок в путях loyalty
  (есть предсуществующие ошибки в `clients`/`stock` — не мои пути, не трогал)
- `npx eslint` по изменённым файлам — 0 ошибок/предупреждений
- `scripts/ensure-dev.sh` — сервер уже работал, не трогал
- `node scripts/measure.mjs --routes /biz/loyalty,/biz/loyalty/cards,/biz/loyalty/card-types --persona owner,network --device phone,desktop` —
  12 страниц, 0 ошибок консоли, 0 сырых ключей, 0 4xx, 0 вылетов; единственное предупреждение на каждой
  странице — та самая `QuotaExceededError` из `mock/db.ts` (подтверждает фундаментный дефект, не мой)
- Снимки `/biz/loyalty/card-types` (owner, десктоп) — вкладки «Активные 1 / Архивные 0», «Постоянный гость —
  Выдано 44 карты» — посмотрел глазами, ок

## done

- F-06-030 (дизайн-часть «архив вместо удаления», В-40) — «Готово, когда» выполнено на моих данных
- Прочие 29 функций пачки g1-1 (F-06-024…191 и т.д.) не трогал в этой пачке — измеритель их принял,
  дефектов по ним не было

## partial

- F-06-175/176/177 — экран прав «Сотрудники → Доступ» не существует (путь `staff`), запрошено
- F-06-030 (часть «переживает перезагрузку») / F-06-149 — блокируется квотой `localStorage` в `mock/db.ts`
  (фундамент), запрошено повторно

## assumed

- Формулировки текста подсказки об архиве и подписей карт (точные слова — на моё усмотрение, смысл из
  questions-q4.md сохранён)
- Порядок вкладок и вид «Активные/Архивные» скопирован 1:1 с уже принятого паттерна `MembershipTypesScreen`
  вместо изобретения нового
