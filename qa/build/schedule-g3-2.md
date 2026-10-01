# Раздел schedule — пачка g3-2

## Что проверялось

Проверяющий (пропуски) прислал 20 F-id: F-02-059, F-02-066, F-02-081, F-02-082, F-02-083, F-02-036,
F-02-022, F-02-058, F-02-060, F-02-063, F-02-018, F-02-074, F-02-088, F-02-011, F-02-040, F-02-084,
F-02-104, F-02-096, F-02-093, F-02-094, F-02-101.

## Диагностика (полная, не сокращённая)

Все 20 пунктов уже были разобраны и запрошены у владеющих разделов в прошлых пачках этого же раздела
(`qa/requests/schedule.md` — записи g1-2-fix2, g1-3-fix1, g2-2-fix1, g2-2-fix2). В этой пачке заново
перепроверила файловую систему по каждому пункту, а не полагалась на память:

- **F-02-059, F-02-066** — движок и канонический тумблер уже в моих путях и работают верно:
  `src/api/schedule.ts` (`effectiveBufferMin`, `getAllowOnlineOverNoShow`/`setAllowOnlineOverNoShow`,
  используются в `computeFreeSlots`/`checkSlot`) и `src/areas/schedule/extensions/SettingsHub.tsx`
  (UI-тумблер). Дефект — в том, что **журнал** (`src/areas/journal/JournalSettingsScreen.tsx`,
  `src/domain/journal.ts`, не мой путь) держит свою НЕЗАВИСИМУЮ пару настроек
  (`defaultBreakAfterMin`, `allowOverlapOverNoShow`), не читая мои `getBufferMin`/
  `getAllowOnlineOverNoShow` — два источника правды. Починка — в journal, не в schedule.
- **F-02-081, F-02-082, F-02-083** — тумблеры уже построены в моём расширении
  `src/areas/schedule/extensions/StaffCard.tsx` (`getIncludeInFillRate/setIncludeInFillRate`,
  `setHiddenInJournal`, `setJournalMarkupMin`) и пишут в общее хранилище (`core.staff`) верно.
  Читающая сторона отсутствует не у меня: расчёт заполненности — `reports` (пусто, 1 файл-заглушка),
  чтение `hiddenInJournal`/`journalMarkupMin` при отрисовке — `journal` (не мой путь).
- **F-02-036** — перерыв по клику на пустое место в журнале: 🔒 помечено в самом ТЗ как мобильное;
  веб-эквивалент — компонент журнала (`DayGrid.tsx`), не мой путь; `grep` по `src/areas/journal`
  подтверждает — 0 совпадений, ничего не построено там же.
- **F-02-022, F-02-058, F-02-060, F-02-063, F-02-018, F-02-074, F-02-088, F-02-011, F-02-040,
  F-02-084, F-02-104, F-02-096, F-02-093, F-02-094, F-02-101** — все физически принадлежат экранам
  других разделов (`services`, `settings`/`onboarding`/`billing`, `network`, `notify`, `reports`,
  `payroll`, `integrations`) по `docs/areas.json`. Перепроверила: `find src/areas/{services,settings,
  notify,reports,integrations,payroll,network} -type f | wc -l` → services=3, settings=1, reports=1,
  integrations=2, payroll=4, network=2 — те же голые заглушки (`nav.ts`/`extensions/*.tsx` в
  7–14 строк), что и сутки назад в g2-2-fix2; `src/app/biz/billing/page.tsx` — по-прежнему
  `AreaPlaceholder`; `staffOverrides` в `src/domain/core.ts` — 0 совпадений (поле для
  F-02-058/060/063 фундаментом не добавлено).

Контракт для всех 15 пунктов из последней группы уже готов на стороне schedule и не менялся
(`getScheduleEnd`, `getScheduledMinutes`, `getWorkDays`, `addWorkDays`, `removeWorkDays`, `DayTypeId`,
`setDayHours`) — см. подробный построчный список в `qa/requests/schedule.md` (записи g1-2-fix2,
g2-2-fix1).

## Почему не строила заново

CONVENTIONS.md §1 запрещает писать вне своих путей (`src/app/biz/schedule/**`,
`src/areas/schedule/**`, `src/domain/schedule.ts`, `src/mock/slices/schedule.ts`,
`src/api/schedule.ts`, `messages/*/schedule.json`, `qa/**/schedule*`) и трогать чужие файлы, пока там
параллельно работают другие помощники. Ни один из 20 F-id не имеет экрана или точки расширения в моих
путях, которая была бы недостроена — то, что можно было построить в своих файлах (движок, хранилище,
канонические тумблеры), построено в прошлых пачках и подтверждено рабочим в этой (tsc/eslint чистые,
data-f уже стоит — F-02-059/066/081/082/083 не попадают в список непомеченных `fids.mjs`).

Записала повторную, актуальную на сегодня диагностику в `qa/requests/schedule.md` (запись «g3-2») —
включая предложение оркестратору либо адресовать эти F-id владеющим разделам напрямую, либо поправить
`docs/areas.json`/`qa/plan/schedule.md`, если диапазон F-02-xxx ошибочно считается «schedule» целиком.

## Проверки

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/schedule.tsbuildinfo` — 0 ошибок в путях
  раздела.
- `npx eslint` по своим путям — 0 ошибок.
- `scripts/ensure-dev.sh` — сервер уже работал на 3710, не трогала.
- `node scripts/fids.mjs --area schedule` — 85 из 121 (70.2%); все 20 F-id этой пачки, кроме
  059/066/081/082/083 (уже помечены в прошлых пачках), остаются в списке непомеченных, так как их
  экран физически не в моих путях.

## done

Пусто — ни один из 20 F-id этой пачки не может быть закрыт из путей `schedule` (все «Готово, когда»
требуют экрана/поля в другом разделе или отсутствующего поля фундамента).

## partial

Все 20, с точной причиной у каждого:

- **F-02-059** — движок и тумблер в schedule верны; журнал держит независимую настройку, не читающую мою.
- **F-02-066** — то же: журнальный тумблер не связан с `getAllowOnlineOverNoShow`.
- **F-02-081** — тумблер записи готов (StaffCard); расчёт заполненности — `reports`, пусто.
- **F-02-082** — `hiddenInJournal` пишется верно; чтение — `journal`, не подключено.
- **F-02-083** — `journalMarkupMin` пишется верно; отрисовка разметки — `journal`, не построена.
- **F-02-036** — 🔒 мобильное по ТЗ; веб-эквивалент в `journal` не построен.
- **F-02-022** — упирается в отсутствие биллинга/лицензии (`settings/billing` — заглушка).
- **F-02-058** — нужен `Service.staffOverrides` в ядре (запрошено) + экран `services`.
- **F-02-060** — экран `services` (список/форма услуги), не построен.
- **F-02-063** — экран `services` (Excel-операции), не построен.
- **F-02-018** — экран онбординга у `settings`, заглушка.
- **F-02-074** — поле `Location.timezone` и экран у `settings`, не построены.
- **F-02-088** — экран «Контакты» у `settings`, не построен.
- **F-02-011** — экран «Типы нерабочих дней» у `network`, не построен.
- **F-02-040** — шаблон уведомления у `notify`; `getScheduleEnd` (мой контракт) не подключена.
- **F-02-084** — отчёт у `reports`, заглушка; денджоминатор (`getScheduledMinutes`/`getWorkDays`) готов.
- **F-02-104** — то же, мобильная аналитика у `reports`.
- **F-02-096** — расчёт зарплаты у `payroll`, заглушка.
- **F-02-093** — каталог интеграций у `integrations`, заглушка; решения по продукту нет.
- **F-02-094** — то же; в ТЗ прямо «решения нет».
- **F-02-101** — то же, Google Maps интеграция у `integrations`.

## assumed

Ничего нового не додумывала — вся конструкция уже описана в прошлых записях `qa/requests/schedule.md`.

## marked

85
