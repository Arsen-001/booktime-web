# Отчёт пачки clients-g3-1 (25.09.2026)

Пачка от проверяющего пропусков. Времени в этом прогоне хватило на явные нарушения «наших решений»
(F-00-132, пуш/SMS из CRM) и один minor-термин; остальное из списка — не сделано, см. `partial`.
Полный обзор `qa/measure/clients/` (§0.1) НЕ пройден целиком — не хватило времени в этой сессии.

## Сделано и проверено

### F-00-132 — «мастер не видит суммы клиента» (закрыто)
Право `rights.viewAccounts` уже существовало в `src/domain/clients/types.ts`, но три места его не спрашивали:
- `src/areas/clients/extensions/BookingWindow.tsx` — «Продано»/«Баланс» скрыты без `viewAccounts` (остаётся
  только «Визитов»), добавлен `data-f="F-04-094 F-00-132"`.
- `src/areas/clients/components/HistoryTab.tsx` — без `viewAccounts` строка визита показывает только статус
  оплаты («Оплачено» / «Не оплачено» / «Долг»), не суммы; добавлен `data-f="F-00-132"`, новый проп
  `canViewAccounts` прокинут из `ClientCardScreen.tsx`.
- `src/areas/clients/components/StatsTab.tsx` — без `viewAccounts` скрыты плитка «Выручка», «Средний чек»,
  график по месяцам; плитка «Любимые услуги/мастера» показывает число визитов вместо суммы.
Новые ключи `card.history.paidFull`, `card.history.paidStatusOnly`, `card.stats.visitsCount` в
`messages/{ru,en}/clients.json`.

### Нарушение «Пуш из CRM без подписки/лимита» и «SMS без провайдера» (`src/api/clients/bulk.ts`) — частично
- `bulkSendMessage`: перед отправкой спрашивает `notify.getSmsSettings(businessId).connected` — без
  подключённого провайдера бросает `ApiError('sms_not_connected')`, модалка показывает тост с просьбой
  подключить канал (не отправляет молча). Закрывает «Снято» №11 / В-08 б.
- `bulkSendPush`: перед отправкой спрашивает `notify.countRecentAppPushes(businessId)` против
  `notify.WEEKLY_PUSH_LIMIT` (тот же счётчик, что у раздела «Уведомления») — сверх лимита бросает
  `ApiError('weekly_push_limit')`.
- `BulkMessageModal.tsx` ловит оба кода ошибки и показывает понятный тост (не общее «не удалось»).
- **Не закрыто**: аудитория пуша по-прежнему считается по CRM-полю `adConsent` (отказ от рекламы), а не по
  настоящей ❤-подписке/приглушению новостей из `client.favorites` — раздел `client` не даёт партийного метода
  для этого за пределами `countNewsSubscribers` (только счётчик, не список). Заявка в `qa/requests/clients.md`
  (2 новые записи: ❤-подписка к `client`, попадание CRM-рассылки в отчёт `notify` к `notify`).

### Термин Altegio «Классы важности» → «Уровни клиента» (minor, закрыто)
`messages/ru/clients.json` (2 места), `messages/en/clients.json` («Importance classes» → «Client tiers», 2 места).

## Проверки
- `npx eslint` по изменённым файлам — чисто.
- `npx tsc --noEmit --incremental --tsBuildInfoFile .tsbuild/clients-g3-1.tsbuildinfo` — 0 новых ошибок в путях
  `areas/clients`, `api/clients`, `domain/clients` (единственная ошибка `lib/changeLog.ts:54` — предсуществующая,
  файл не трогал).
- `node scripts/measure.mjs --area clients --routes /biz/clients --persona owner --lang ru --device phone` (9
  страниц раздела, включая `/biz/clients/cl_001` и `/dev/ext/bookingWindow/clients`) — 0 ошибок консоли, 0
  4xx/5xx, 0 сырых i18n-ключей, 0 вылетов.
- `node scripts/fids.mjs --area clients` после работы: **143 / 237 (60.3%)**.

## В работу НЕ взято (осталось от списка проверяющего)

Не хватило времени в этом прогоне — не начато, не проверено на моках:
- F-00-127 (отметка «пришёл» из уведомления в 1–2 нажатия)
- F-04-036 (несколько условий «есть/нет записей» в одной группе фильтра)
- F-04-038 (запись рассылки CRM в отчёт `notify.log`) — заявка подана, сам не строил (принадлежит `notify`)
- F-04-055 (скидка клиента не подставляется в новую запись)
- F-04-069 (поворот фото — просьба к ImageUpload, фундамент)
- F-04-154 (анкета согласия — публичный маршрут вместо каркаса кабинета)
- F-04-156 (уведомление мастеру о неявке)
- F-04-192 (ИИН из онлайн-записи)
- F-04-201 (право `bookingWindowCreateClients` нигде не читается — поле выбора/создания клиента в окне
  записи строит `journal`, не `clients`; нужна либо чужая правка, либо явная делегация)
- F-04-227 (отписка у получателя + модерация тем новостей)
- ⭐ arch (Certificate/Subscription/ProductPurchase → loyalty/stock) — заявка уже была подана прежним
  строителем (см. `qa/requests/clients.md`, запись «g2-1 · Просьба к loyalty»)
- core-rules (два пункта: «только свои клиенты» через `staffClientVisibility`/`isOwnClient`; маска телефона
  в `api`, не только в интерфейсе)
- ux («Долг N ֏» — вести в оплату, не в список)
- ui (Stepper в мастере импорта, FilterBar над списком, CountryPhoneField)
- qa-marks (проставить ✅ у recheck-c3 №1, ux-best-c3 №1, text-q4 №1/№2 — не проверял их фактическое состояние)
- F-04-155/162/178 (finance не построил F-07-…), F-04-189/191/193 (integrations не построил F-13-…) — чужие
  разделы, не наши пути.
- Полный проход по `qa/measure/clients/` (§0.1: `ux-r1/r2/r5`, `ux-best-*`, `speed-*`, `text-*`, `e2e-*`,
  `recheck-*`, `demo-*`, `onboarding-*`, `a11y-*`, `core-*`, `decision-*`, `state-s1`, `build-q3`, `empty-d1`) —
  десятки непомеченных major/block, не открывал и не закрывал ни один в этом прогоне.

## assumed
- «❤-подписка» без доступного из CRM метода временно = «есть приложение и не отказался от рекламы» (CRM-поле
  `adConsent`), пока `client` не отдаст список подписчиков — так CRM хотя бы не шлёт совсем без ограничения.
- Термин «Уровни клиента» выбран как свой аналог Altegio «Класс важности» (F-04-053); можно оспорить, но не
  Altegio-калька.
