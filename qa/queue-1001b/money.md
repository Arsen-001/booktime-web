# queue-1001b · money — деньги групповых занятий, финансы, пробный период, лояльность, зарплата (01.10.2026)

Эталон — мок (`src/api/*.ts`). Помощник backend-2 уже закрыл бóльшую часть пунктов. Я сверил каждый с моком,
доделал то, что расходилось, и проверил всё вживую на копии сервера (:4025, база-копия `booktime_finqa`).

## Итог по пунктам

| # | Пункт | Состояние |
|---|---|---|
| 1 | Групповые: `payParticipant` → деньги в кассу | **Переделано на сервере.** Мок уже платил через `payBookingQuick`. Сервер вёл свою операцию «Оплата участника» и ставил `prepayment.paid`, в обход строк оплаты визита. Теперь наличные и карта идут через `BookingPaymentsService.pay` (mode `quick`) — так же, как «Оплатить» в журнале. Отмена снимает платёж визита (`cancelLine`). «Другое» и абонемент работают как в моке: только отметка. Старые оплаты участника (своя операция плюс строка `participant`) отменяются по-прежнему. |
| 2 | Финансы: prepayment-received/refund-done, 409 на правку, 409 removeAccount, Z по createdAt, продажа лояльности | Уже было сделано (backend-2): `prepayment-ops.ts` + `bookings.service`, `operation_linked`, `account_in_use`, `cash-shifts` по `createdAt`, `POST …/finance/loyalty-sales`. Перепроверил вживую: 409 `account_in_use` и 409 `operation_linked`. |
| 3 | 7 дней пробного периода при самостоятельной регистрации | Уже было: `billing/registration.ts` → `startIntroTrial` (статус `trial`, 7 дней). |
| 4 | Вторая карта того же типа | Уже было: `card_type_already_issued` (409) в `loyalty-instances.service` и `port/logic.ts`. |
| 5 | `/loyalty/x/*` без аргументов → 500 | Уже было: `port/arity.ts` + `checkArgs` в runner. Вживую `createCardType` с `args: []` отвечает **400** `validation` (`fields: {"args.1":"object"}`). |
| 6 | Зарплата: товары, день визита, прибыль за период, computePeriod только свой | Товары (`productSalesPay`), «за записи» днём визита и только для «Пришёл», прибыль за месяц, `calcScope` (только своё) — уже было. **Добавил** то, чего не хватало серверу по сравнению с моком: F-09-005 «Дата поступления средств на счёт» (`accrualDateBasis: 'received'`, `accrualLookup`). Убрал устаревшую пометку «товары = 0» в `payroll-engine.ts` и `docs/PROGRESS.md`. |

## Изменённые файлы
- `booktime-backend/src/modules/resources/resources-events.service.ts`: `payParticipant` и `cancelParticipantPayment` переведены на `BookingPaymentsService`, добавлен `cancelLegacyParticipantPayment`. Зависимость `FinanceCatalogService` больше не нужна.
- `booktime-backend/src/modules/finance/prepayment-ops.ts`: удалены `recordParticipantPaymentTx`/`participantMethodTx`. Метки и отмена старых оплат оставлены.
- `booktime-backend/src/modules/payroll/payroll-engine.ts`: `accrualDateForBooking` в `ComputeDayInput`, `accrualDateOf`, обновлена шапка.
- `booktime-backend/src/modules/payroll/payroll-compute.service.ts`: `accrualLookup` (строки `BookingPayment` и предоплата «Деньги пришли»; визиты вне диапазона, оплаченные в периоде, тоже попадают в расчёт), `engineBookingOf`; подключено в день, период и ведомость.
- `booktime-backend/docs/PROGRESS.md`: снята пометка «productsAmount всегда 0».
- `booking-platform/src/api/resources.ts`: только комментарий у `payParticipant` (старый текст «деньги не принимаем»).

## Как проверено
- Бэкенд: `npm run -s typecheck` — 0 ошибок; `check:permissions` — «Права совпадают: 40».
- Копия сервера на :4025 (сборка в `node_modules/.cache/money`, база `booktime_finqa`). После проверки сервер остановлен, база и сборка удалены. :4010 не трогал.
  - Групповое занятие `bk_0073`, оплата наличными: операция `income 3000 cash` в кассе `fr_loc_arman_cash` (source `booking`), строка `booking_payments money/cash`, `paidAmount 3000`, сводка визита `status: paid, due: 0`. Повторная оплата — 422 `invalid_amount`. Отмена: операция и строка платежа уходят в отменённые, `paidAmount 0`, отметка снята. «Другое» — только `prepayment {paid}` без денег, отмена снимает.
  - Лояльность: `POST loyalty/x/createCardType {args:[]}` → 400.
  - Финансы: удаление кассы со способом оплаты → 409 `account_in_use`; правка операции визита → 409 `operation_linked`.
  - Товары: продавец sona, 10 % от 3 800 ֏ = **380** — одно и то же в «Расчёте за день» и «Расчёте за период».
  - Дата начисления: визит `bk_3671` от 19.06, оплачен 28.09. С настройкой `visit` он в 19.06, с `received` — в 28.09; сентябрь вырос с 505 000 до 569 000.
- Фронт: `npx tsc --noEmit -p .` — 0; `npx eslint src/api/resources.ts` — чисто; `node src/domain/rules/tests/run.mjs` — 95/95.
- Снимков нет: экраны не менялись (только сервер и комментарий).

## Миграции
**Не нужны.** Схему базы я не менял. openapi.json тоже не меняется: маршруты и тела запросов остались прежними.

## Замечено, но не моё (для главной сессии)
- Мок `payBookingQuick` переводит запись в «Пришёл» (`markArrivedIfNeededSync`), а серверный `POST …/finance/bookings/:id/payments` статус не трогает. Это касается и журнала, и оплаты участника. Расхождение общее для оплаты визита, поэтому в рамках своего пункта я его не правил.
- Срок зачисления карты (`settlementDays` мока) на сервере не хранится. Для «Даты поступления» берётся 0 дней — так же, как мок по умолчанию.
