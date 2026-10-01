# loyalty · починка g1-2, пачка fix1 (25.09.2026)

Чинил 5 дефектов из доделки g1-2 (все major). Перед началом прочитал все файлы `qa/measure/loyalty/`
кроме своих `b*-m*`/`g*-m*` (§0.1) и закрыл ещё несколько block/major сверху, начиная с экранов, которые
трогал в этой пачке (хаб, сертификаты, абонементы).

## Дефекты из задания

### F-06-074 — done
Удаление записи, оплаченной абонементом/картой/сертификатом/счётом, не возвращало списанное — journal
удаляет запись в своём срезе (`Booking.deletedAt` в ядре) и не знает про `paidBookingIds` лояльности,
окно записи не даёт хука «перед удалением». Добавил в `src/api/loyalty.ts` самовосстановление:
`reconcileDeletedBookingPayments(businessId)` читает `core.bookings` (только чтение — разрешено),
находит оплаты за визиты с `deletedAt` старше окна «Отменить» (5000мс тоста + запас), откатывает их той
же логикой, что явная кнопка «Отменить оплату лояльностью» (вынес общую `reverseLoyaltyPaymentLines`), и
вызывается в начале `listMemberships`/`listCertificates`/`listCards`/`listTransactions`/
`getLoyaltyPaymentSummary`/`getLoyaltyBookingSummary` — поэтому и реактивно обновляется в той же сессии
(чтение `core.bookings` автоматически становится зависимостью открытых запросов).
Проверено вживую (`qa/scenarios/loyalty/g1-2/membership4-delete-verify.mjs` →
`membership4-tab-check.mjs`): клиент Нелли Симонян, абонемент «Маникюр × 5» 2/5 → списал визит → удалил
запись → подождал > 6с (окно отмены) → карточка клиента, вкладка «Лояльность»: «Маникюр × 5 · Активен ·
Остаток **2** из 5» (`qa/shots/loyalty-g1-2/membership4/5-loyalty-tab.png`) — верно.

### F-06-123, F-06-124 — done
У абонементов в моке не было `code` (в отличие от сертификатов) — «чужой абонемент по коду» было
структурно непроверяемо: `findLoyaltyByCode` при любом вводе возвращал «не найдено». Добавил
`code: 'MEMB-100X'` в сид (`src/mock/slices/loyalty.ts`, версия среза 7→8, чтобы пересеялось у всех, у
кого уже есть старые данные без кода) и колонку «Код» в список `/biz/loyalty/memberships`
(`memberships.columns.code`, ru/en). Проверил вживую действием, не только структурно
(`qa/scenarios/loyalty/g1-2/membership-code-search-verify.mjs` →
`membership-code-transfer-verify2.mjs`): в окне записи Мариам Петросян нашёл по коду `MEMB-1000`
(владелец — другой клиент, +374 00 160 001), «Списать визит» → «Провести оплату лояльностью» → закрыл
окно (Escape, без перезагрузки) → перешёл SPA-навигацией на `/biz/loyalty/memberships` — строка
MEMB-1000 теперь у **+374 95 420 488** (Мариам) с остатком **2 из 11** (было 3 из 11 у прежнего
владельца) — перенос владения подтверждён действием в той же сессии
(`qa/shots/loyalty-g1-2/final/6-memberships-spa-after-transfer.png`).

### F-06-097 — partial, корень не в моих путях
Сама оплата чужим сертификатом по коду отрабатывает верно и синхронно (тот же движок
`commitLoyaltyPayment`, что и у абонементов выше, — подтверждено кодом и логами: `paidBookingIds`,
`transactions`, `certificate.clientId` меняются в ОДНОЙ мутации). Но измеритель проверял через
`page.goto()` между шагами (реальный сценарий `cert-transfer2.mjs`), и это переживает ровно ту проблему,
что в требовании ниже — воспроизвёл живьём с перехватом `console.warn` (у прошлых замеров фильтр ловил
только `console.error`): на СВЕЖЕМ профиле Chromium уже первый `localStorage.setItem('bp-mock-db', …)`
(сериализация всей базы 18 разделов одним блобом) кидает `QuotaExceededError` — ни один `page.goto`
после этого не видит новых данных, база пересевается заново. Это `src/mock/db.ts` — общий фундамент, не
мои пути; прошу в третий раз (после b05-fix1/fix2, g1-1-fix2) в `qa/requests/loyalty.md` с новыми
доказательствами (запись от 25.09 g1-2-fix1). Не размечаю F-06-097 как «done», потому что его «Готово,
когда» требует именно того, что блокирует эта квота.

### F-06-076 — partial, тот же фундаментный корень
«Каждая операция лояльности пишется одним из этих типов» — сами транзакции пишутся верно (проверено
кодом и структурой `commitLoyaltyPayment`/`reverseLoyaltyPaymentLines`/`adjustCardBalance`/новым
`adjustCertificate`), но список `/biz/loyalty/transactions` не видит их после `page.goto` по той же
причине, что F-06-097. Уже было отправлено фундаменту трижды; подтвердил снова и добавил запись.

## Сверх задания — доделки из §0.1 (по своим экранам + ещё несколько)

Прочитал `qa/measure/loyalty/{ux-best-c1,c2,c3,text-q4,recheck-c3,e2e-q4,onboarding-k1,demo-q4,
questions-q4,core-rules,decision-c1,decision-c3}.md`. Закрыл:

- **recheck-c3 F-06-077** (major) — ручная правка баланса сертификата не писала транзакцию. Теперь
  `adjustCertificate` пишет `manualTopup`/`manualCharge` на разницу (как `adjustCardBalance`), с автором
  (`by: staffId`) — видно и в «Списаниях» сертификата, и в `/biz/loyalty/transactions`.
- **recheck-c3 F-06-100** (major) — «Место использования» было пусто у частично использованных
  сертификатов (`usedLocationId` пишется только когда сертификат закрылся до нуля). Добавил
  `usedLocationNames: string[]`, считает из строк `certificateCharge`; колонка и карточка сертификата
  показывают одно место или «Nuri + ещё N» (`certificates.usedLocationsMore`, ru/en).
- **ux-best-c1 №1 / ux-best-c3 №1** (оба major, один и тот же приём) — хаб `/biz/loyalty` показывал
  везде одинаковое «Настроить», хотя половина уже работает. Новый лёгкий запрос
  `getLoyaltyHubOverview()` + у каждой плитки строка состояния «Не настроено» (кнопка primary
  «Настроить») / «Настроено · пока ничего не продано» / «Работает · продано N, на X ֏» (кнопка outline
  «Открыть»). Снимки `qa/shots/loyalty-g1-2/hub/{1-desktop,2-mobile}.png`.
- **text-q4 №4** (major, частично) — терминология «бонусы/кэшбэк»: `promotions.kinds.cashbackFixed`
  приведён к примеру из отчёта («Кэшбэк: один процент» / «Cashback: flat rate»); полную сверку всех 664
  ключей по глоссарию §6 не потянул в бюджет пачки — отмечено ⏳ в файле.

Отложил (⏳, с причиной, в самих файлах измерения): text-q4 №1 (30 ключей «локация→филиал», отдельная
задача), ux-best-c2 (карточки типов акций, авто-первая-строка в оплате, защита выданных при удалении
типа — редизайн, не влезал в бюджет), ux-best-c3 №4 (абонемент к чужой услуге — корень в сиде `client`,
не мой путь), e2e-q4 (нужна функция для раздела `client`, не только моя правка).

## Проверка

- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/loyalty.tsbuildinfo` — 0 ошибок в моих
  путях (`src/api/loyalty.ts`, `src/areas/loyalty/**`, `src/mock/slices/loyalty.ts`); все оставшиеся
  ошибки — в `src/areas/client/**` и `src/areas/clients/**` (чужие разделы, были и до пачки).
- `npx eslint` по всем изменённым файлам — 0 ошибок/предупреждений.
- `node scripts/measure.mjs --area loyalty --persona owner --lang ru --device desktop` — 20 страниц,
  **0 ошибок консоли, 0 4xx/5xx, 0 сырых i18n-ключей, 0 горизонтального вылета**; 1 предупреждение на
  страницу — тот же известный `QuotaExceededError` из `src/mock/db.ts` (см. F-06-097/076 выше), не
  регрессия.
- Снимки посмотрел глазами (Read png): хаб (десктоп+телефон), список сертификатов, список абонементов,
  окно записи с поиском по коду абонемента, карточка клиента после восстановления абонемента.
- `node scripts/fids.mjs --area loyalty` после работы: **134 из 198 (67.7%)**.

## Файлы

- `src/api/loyalty.ts` — `reconcileDeletedBookingPayments`, `reverseLoyaltyPaymentLines` (общая),
  `getLoyaltyHubOverview`, `usedLocationsOf`, `adjustCertificate` (транзакция), везде подключил
  reconcile в чтения.
- `src/mock/slices/loyalty.ts` — `code` у абонементов, версия среза 8.
- `src/areas/loyalty/LoyaltyHubScreen.tsx` — статус по плиткам.
- `src/areas/loyalty/MembershipsScreen.tsx` — колонка «Код».
- `src/areas/loyalty/CertificatesScreen.tsx`, `certificates/CertificateDetailScreen.tsx` — места
  использования списком.
- `src/areas/loyalty/extensions/ClientCard.tsx` — передаёт `staffId` в `adjustCertificate`.
- `messages/{ru,en}/loyalty.json` — новые ключи (`memberships.columns.code`, `hub.status.*`,
  `hub.tiles.open`, `certificates.usedLocationsMore`), правка `cashbackFixed`.
- `qa/requests/loyalty.md` — новая запись про квоту (третье подтверждение, с доказательствами g1-2).
- `qa/measure/loyalty/{recheck-c3,ux-best-c1,ux-best-c3,text-q4,e2e-q4}.md` — отметки ✅/⏳.
- `qa/scenarios/loyalty/g1-2/*.mjs` (новые) — сценарии проверки починки, снимки в
  `qa/shots/loyalty-g1-2/{membership4,hub,final}/`.
