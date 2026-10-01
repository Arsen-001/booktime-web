# Раздел loyalty — починка g1-2-fix2 (25.09.2026)

Чинил дефекты, найденные измерителем в доделке g1-2. Отчёт по каждому.

## Список дефектов и что сделано

### block — arch: `src/api/loyalty.ts:11` импортировал `AreaStates` из `@/mock/slices`
`node scripts/arch-check.mjs --area loyalty` падал на A2 (тип-импорт всё равно матчился правилом «моковая
база мимо api» — `src/api/<area>.ts` не входит в `MOCK_ALLOWED`, только `core.ts/area.ts/request.ts`).
Починил как в `src/api/journal.ts` (готовый паттерн в этом же репозитории): `type LoyaltyArea = ReturnType<typeof readArea<typeof AREA>>`
вместо прямого импорта типа среза. Два внутренних хелпера (`reverseLoyaltyPaymentLines`, `usedLocationsOf`)
переведены на `LoyaltyArea`. `node scripts/arch-check.mjs --area loyalty` теперь завершается кодом 0 (только
warn-уровня A8/A10/A12/A13/A14, не блокируют).

### major — F-06-100/076/129/141: «Выгрузить в Excel» / «Операции с Excel» были заглушками
Все 4 экрана (`CertificatesScreen`, `TransactionsScreen`, `MembershipsScreen`, `AccountOperationsScreen`)
звали только `toast.success(...)` без файла. Подключил `toCsv`/`downloadCsv` из `@/lib/csv` (готовая
утилита проекта, тот же паттерн, что в `finance/OperationsScreen.tsx` и `clients/ClientsListScreen.tsx`) —
каждая кнопка теперь строит CSV из реальных строк таблицы (те же колонки, что на экране) и скачивает файл
(`certificates.csv`, `loyalty-transactions.csv`, `memberships.csv`, `account-operations.csv`), тост
показывается уже после старта скачивания. **Проверено действием**: `qa/scenarios/loyalty/g1-2-fix2/csv-export-check.mjs`
(Playwright, живой дев-сервер, персона owner) — на все 4 маршрута реальное событие `download` с ожидаемым
именем файла.

### major — F-06-028: тумблер «Не отображать» кэшбэк в приложении клиента
Перепроверил вживую и по коду — поле **уже реализовано полностью**: `CardType.cashbackVisibleInApp`
(`src/domain/loyalty.ts`), форма `CardTypeFormScreen.tsx` (радио-группа `data-f="F-06-028"`, сохраняется
через `save()`), сид (`src/mock/slices/loyalty.ts`) и применение в API (`src/api/loyalty.ts:2536` — клиентская
DTO фильтрует карты выключенного типа). Замечание измерителя было ложным (возможно, снято до того, как эту
функцию доделали в предыдущей пачке) — правок не потребовалось, оставил как есть.

### major — F-06-097/F-06-152: перенос владения и подтверждение онлайн-заказа не переживают перезагрузку
Это фундаментный дефект `src/mock/db.ts` (`QuotaExceededError` на первой же записи в `localStorage` на
свежем профиле — вся демо-база 18 разделов уже больше квоты браузера), не в путях раздела, прошу уже 4-й раз
(`qa/requests/loyalty.md`, запись `g1-2-fix2`). Переподтвердил вживую (Playwright, перехват `console.warn`
на `/biz/loyalty/certificates?demo=owner`, свежий контекст) — та же ошибка `QuotaExceededError`.

Отдельно **проверил, что сама бизнес-логика F-06-152 работает корректно**, обойдя баг персистентности
через SPA-навигацию (клики по `next/link`, без `page.goto`/перезагрузки — Zustand в памяти не сбрасывается,
теряется только `localStorage`): `qa/scenarios/loyalty/g1-2-fix2/f06-152-flow.mjs` прошёл целиком —
включил витрину → включил «Доступно для продажи онлайн» у типа сертификата → купил его на
`/biz/loyalty/online-sales/preview` → заказ появился на `/biz/loyalty/online-sales/orders` со статусом
«Ждёт оплаты» → «Подтвердить» → статус стал «Подтверждён», 0 ошибок консоли. `confirmOnlineOrder`/
`rejectOnlineOrder` подключены верно. F-06-097 (перенос сертификата оплатой) логику не гонял отдельным
сценарием (требует окна записи из другого раздела — journal), доверяю коду и прошлой live-проверке
(`g1-2-fix1`, тот же движок `commitLoyaltyPayment`/`reverseLoyaltyPaymentLines`).

## Замечания других проверяющих (§0.1) — что починил сверх списка

Прочитал все файлы `qa/measure/loyalty/` вне `b*-m*/g*-m*` (`a11y-q2/q3`, `arch-a1`, `core-rules`,
`decision-c1/c3`, `demo-q4`, `e2e-q2/q3/q4`, `onboarding-k1`, `questions-q4`, `recheck-c3`, `text-q2/q4`,
`ux-best-c1/c2/c3`) — почти все block/major уже отмечены ✅/⏳ прошлыми пачками. Новое, что починил:

- **e2e-q4 №4 (minor):** список абонементов показывал клиента только телефоном без имени. `MembershipRow`
  уже содержал `clientName` — просто не читался на экране. Добавил `Имя · телефон` в колонку и в CSV-экспорт
  (`MembershipsScreen.tsx`). Отмечено ✅ в файле.
- **ux-best-c3 №2 (major, частично):** «Сертификаты: у клиента нет имени, у остатка нет срока». Добавил
  `Имя · телефон` в колонку «Клиент» (та же правка, что у абонементов) и новую колонку «Срок»
  (`certificates.columns.expiresAt`, `certificates.daysLeft` — ru/en, plural) с `text-warning` при ≤14 дней
  до сгорания. Не переделывал остаток в progress-bar и не убирал колонку «Место» для одноадресных — отдельный
  заход, отметил в файле, что именно осталось.
- **a11y-q2, recheck-c3, text-q4, questions-q4, demo-q4, e2e-q2/q3, decision-c1/c3, onboarding-k1, core-rules:**
  всё либо уже ✅, либо явно помечено «не переподтверждено»/«ждёт раздела: ничего» — новых починок не требовали.
- **text-q4 major №1/№5** (терминология «локация→филиал», «депозит→счёт») — большая сквозная правка по ~16+
  ключам всего раздела, уже дважды помечена ⏳ прошлыми пачками как отдельный заход не в бюджет точечной
  починки; не трогал в этой пачке (не связано ни с одним из 7 дефектов и не в затронутых мной экранах).

## Проверки перед сдачей

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/loyalty.tsbuildinfo` — 0 ошибок в путях loyalty
  (2 оставшихся ошибки в выводе — `src/areas/client/book/*` — чужой раздел, не трогал).
- `npx eslint` по всем 5 изменённым файлам (`CertificatesScreen.tsx`, `TransactionsScreen.tsx`,
  `MembershipsScreen.tsx`, `AccountOperationsScreen.tsx`, `src/api/loyalty.ts`) — чисто.
- `node scripts/arch-check.mjs --area loyalty` — код возврата 0 (0 error, только warn).
- `scripts/ensure-dev.sh` — сервер уже работал, не трогал.
- `node scripts/measure.mjs --routes /biz/loyalty/certificates,/biz/loyalty/transactions,/biz/loyalty/memberships,/biz/loyalty/deposits/operations,/biz/loyalty/online-sales,/biz/loyalty/card-types --persona owner --device phone,desktop`
  → `qa/measure/loyalty/g1-2-fix2/report.json`: 12 страниц, **0 ошибок консоли**, 0 4xx/5xx, 0 сырых i18n-ключей,
  0 горизонтального вылета, 0 целей < 40px, только штатное предупреждение о квоте `localStorage` (1 warn/стр).
- Снимки просмотрел глазами (`Read` png): `certificates` desktop и phone — имя+телефон клиента и колонка
  «Срок» с «через N дней» отображаются верно, тёмного текста/обрезаний нет.
- Живые сценарии: `qa/scenarios/loyalty/g1-2-fix2/csv-export-check.mjs` (4/4 CSV скачиваются),
  `qa/scenarios/loyalty/g1-2-fix2/f06-152-flow.mjs` (весь цикл заказа онлайн-продажи проходит).

## done

- F-06-100 (экспорт сертификатов — настоящий CSV)
- F-06-076 (экспорт транзакций — настоящий CSV)
- F-06-129 (экспорт абонементов — настоящий CSV)
- F-06-141 (экспорт операций по счетам — настоящий CSV)
- F-06-028 (тумблер видимости кэшбэка — уже был реализован полностью, перепроверил)
- F-06-152 (заказ онлайн-продажи: создание → подтверждение/отклонение — логика проверена действием целиком)

## partial

- **F-06-097** — «Готово, когда» формально не подтверждено live-прогоном ИМЕННО этого сценария (перенос
  сертификата оплатой через окно записи — требует журнала, другого раздела); логика движка
  (`commitLoyaltyPayment`/`reverseLoyaltyPaymentLines`) не менялась с прошлой пачки, где была проверена
  действием (`g1-2-fix1`). Не «готово, когда» пункт не выполняется по факту: реальный блокер — квота
  `localStorage` в `src/mock/db.ts` (фундамент), не мой код. Прошу в `qa/requests/loyalty.md` четвёртый раз.
- **F-06-152** — сама логика подтверждена действием целиком (см. done), но пункт «переживает перезагрузку»
  из общего требования задания не выполняется по той же причине — квота `localStorage`, фундамент.

## assumed

- Клиент/телефон в CSV-экспортах форматирую так же, как в UI-колонках (`format.money`/`format.phone`/`format.date`),
  чтобы Excel-файл 1:1 совпадал с тем, что видно на экране.
- Для «Срок» сертификата (ux-best-c3 №2) выбрал формат «дата · через N дней» и порог 14 дней по образцу
  самого замечания измерителя («через 71 дн.», «меньше 14 дней — оранжевым») — своих чисел не выдумывал.
- Расширенную колонку «Клиент» (имя+телефон) сделал одинаково в сертификатах и абонементах — не стал заводить
  права `clients.phones` (не в моих путях, `src/config/permissions.ts`), телефон остаётся виден всем, кто
  видит сам экран, как было раньше.

## checks

`npx tsc --noEmit` (loyalty: 0), `npx eslint` (5 файлов: 0), `node scripts/arch-check.mjs --area loyalty`
(exit 0), `node scripts/measure.mjs` (12 стр., 0 ошибок консоли), 2 живых Playwright-сценария (CSV × 4,
онлайн-заказ целиком), 2 снимка просмотрены глазами.

## marked

134 (`node scripts/fids.mjs --area loyalty` после работы: `loyalty 198 134 67.7%`)
