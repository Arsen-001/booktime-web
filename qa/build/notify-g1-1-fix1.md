# Отчёт · notify · g1-1-fix1 (починка дефектов после измерения g1-1)

25.09.2026. Измеритель проверил доделку g1-1 (F-05-001, F-05-002, F-05-003, F-05-005, F-05-007, F-05-008,
F-05-061, F-05-062, F-05-065, F-05-068, F-05-077, F-05-079, F-05-092, F-05-093, F-05-094, F-05-095,
F-05-096, F-05-097, F-05-107, F-05-009, F-05-010, F-05-011, F-05-018, F-05-019, F-05-022, F-05-024,
F-05-025, F-05-026, F-05-027, F-05-028) и нашёл 3 дефекта. Разобраны все три.

## Что почищено

- **F-05-002 (minor, наш путь) — почищено.** `src/areas/notify/TypesTab.tsx`, `TypeRow`: на телефоне
  390×844 метки подключённых каналов у строки типа были скрыты классом `hidden sm:flex` — виден был
  только тумблер вкл/выкл, а какой канал уйдёт («Пуш в приложение», «SMS», «Email» и т. д.) — нет. Убрал
  `hidden`/`sm:flex`, строка типа стала `flex-col` на мобильном (название сверху, каналы бейджами под ним,
  без обрезки и переполнения) и `sm:flex-row` на десктопе (как было — каналы справа в одну строку).
  Проверено снимком `qa/shots/notify-g1-1-fix1/biz-notifications__owner-nails-ru-light-phone.png` — под
  каждым типом видна метка канала на телефоне.

## Что НЕ починено — и почему (оба уже были задокументированы как открытые запросы к фундаменту/соседям)

- **F-05-061 (major) — блокер не в notify, файл чужой.** `src/shell/workspace/NotificationsBell.tsx`
  (`src/shell/**` — фундамент, не наш путь) всё ещё рисует статичный `EmptyState` вместо счётчика/красной
  точки. С нашей стороны сделано всё нужное ещё в b01-fix2: `src/api/notify.ts` экспортирует
  `countUnreadInbox(businessId)` и `listInboxPreview(businessId, limit)` — готовые функции, которые
  колокольчику нужно только вызвать. Сама страница `/biz/notifications/inbox` (наш путь) работает
  полностью — счётчик непрочитанных, красная точка у строк, «Отметить все прочитанными». Мы не правим
  `src/shell/**` сами (правило раздела «пишите только в своих путях») — добавил повторную, более заметную
  запись в `qa/requests/notify.md` (раздел «g1-1-fix1») с точным именем функций, которые нужно подключить.
- **F-05-001 (major) — блокер у раздела online, не у notify.** Второй и третий вход в раздел (плитка из
  хаба настроек онлайн-записи, пункт «Уведомления клиенту» в «Основных настройках» `/biz/online/settings`)
  всё ещё не ведут на `/biz/notifications` — проверил: `grep -rn "biz/notifications" src/app/biz/online
  src/areas/online` пусто, страница `/biz/online/settings` не даёт такой ссылки. Это путь раздела `online`
  (`src/app/biz/online/**`, `src/areas/online/**`) — чужой, не наш. Просьба уже стоит в
  `qa/requests/notify.md` (запись b01) с точным описанием, что нужно; online её ещё не выполнил.

## Проверки перед сдачей

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/notify.tsbuildinfo` — 0 ошибок в путях notify
  (`src/app/biz/notifications`, `src/areas/notify`, `src/domain/notify.ts`, `src/mock/slices/notify.ts`,
  `src/api/notify.ts`).
- `npx eslint src/app/biz/notifications src/areas/notify src/domain/notify.ts src/mock/slices/notify.ts
  src/api/notify.ts` — 0 ошибок.
- `node scripts/measure.mjs --routes /biz/notifications,/biz/notifications/mailings,
  /biz/notifications/log,/biz/notifications/inbox --persona owner --lang ru --device phone,desktop` — 8
  страниц, 0 ошибок консоли, 0 4xx/5xx, 0 сырых ключей, 0 горизонтальных вылетов, 0 мелких целей нажатия.
  Отчёт: `qa/measure/notify/g1-1-fix1-report.json`, снимки: `qa/shots/notify-g1-1-fix1/`.
- Снимок `/biz/notifications` на телефоне (см. выше) — глазами: строки типов теперь показывают канал под
  названием, не только тумблер.
- `node scripts/fids.mjs --area notify` после работы: **88 из 139 помечено (63.3%)**.

## done / partial

done: F-05-002 (доделан на этой пачке).

partial:
- F-05-061 — блокирован чужим файлом `src/shell/workspace/NotificationsBell.tsx` (фундамент); наша часть
  API готова, просьба зафиксирована и повторена.
- F-05-001 — блокирован разделом `online` (второй/третий вход в раздел); просьба зафиксирована ранее.

Остальные F-id из списка измерителя (F-05-003, F-05-005, F-05-007, F-05-008, F-05-062, F-05-065,
F-05-068, F-05-077, F-05-079, F-05-092…097, F-05-107, F-05-009…011, F-05-018, F-05-019, F-05-022,
F-05-024…028) дефектов в этой проверке не получили — не трогались.
