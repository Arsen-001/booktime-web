# online · правила — только из ядра (core-rules, 25.09.2026)

Хранитель ядра. Вы — **хозяин настроек** правил записи: пишете `Business.bookingRules` / `Staff.bookingRules`,
`Staff.confirmMode`, `Staff.onlineBookingEnabled`, `Staff.prepayment`; правила считает ядро (`@/domain/rules`, 72 теста).
Номера строк — на момент 25.09 ~03:10.

## Major

1. **Создание записи виджетом → `coreTx.placeBooking`** — `src/api/online.ts:335` `createOnlineBooking`: 4 вложенных
   запроса (`findClientByPhone`, `coreCreate`, `createBooking`), окно по `svc.durationMin` без «от–до» и запаса,
   `new Date(input.start)` (сдвиг пояса), статус без предоплаты мастера. Как — внутри своего `request()`:
   ```ts
   const { booking, client } = coreTx.placeBooking(
     { source: input.source, businessId, locationId, staffId, start, services: input.services, workplace, forWhom,
       comment, client: { phone: input.clientPhone, name: input.clientName }, staffAssignment },
     { isStartOffered: (q) => computeFreeSlots(readCore(), q).some((s) => s.start === q.start) },
   );
   mutateArea('online', (s) => { s.bookingMeta[booking.id] = meta; });
   ```
   Пауза локации и отпуск мастера ядро уже читает из вашего среза (`businessRules.pauseUntil`, `staffRules.vacationUntil`) —
   свои проверки удалить. Выезд, «кого принимаю», блокировка, «только мои клиенты» — в ядре.
2. **Отмена/перенос по ссылке → ядро** — `:639` `getCancelWindow`, `:658` `cancelOnlineBooking`, `:677` `rescheduleOnlineBooking`,
   `:559` `hoursUntil` (`Date.now()`/`new Date`). Как: проверить хэш, затем `coreTx.cancelByClient(id)` → `{ booking, late }` /
   `coreTx.rescheduleByClient(id, start)`; окно показа — `effectiveBookingRules(business, staff)`, `canCancelFree`,
   `clientCancelOutcome`, `canReschedule` (в ответе `until`).
3. **Сроки → поля ядра** — `src/domain/online.ts:59–80` `StaffOnlineRules.cancelWindowHours/rescheduleWindowHours` и
   `DEFAULT_STAFF_ONLINE_RULES`: перенести в `Staff.bookingRules.{cancelWindowMin,rescheduleWindowMin}` (минуты, шаг 15),
   правило бизнеса — `Business.bookingRules`, плюс `allowCancel/allowReschedule/allowCancelPrepaid/allowReschedulePrepaid`.
   Экран `src/areas/online/settings/SettingsScreen.tsx:111,200–214` пишет в ядро (`coreUpdate('staff'|'businesses', …)`).
   Дефолт ядра — 180 мин (ваш прежний 3 ч). Поднять `version` среза после удаления полей.
4. **Видимость → ядро** — `:157` `isStaffOnlineVisible`, `:555` `isListable`, `:175` `getPublicBusinessData` (без модерации и
   `onlineBookingEnabled`). Как: `staffClientVisibility(core, staff, { hiddenIds: moderationHiddenIds() })` → `{ catalog, link,
   bookable, requestOnly, reasons }` (reasons = чего не хватает профилю, для подсказки «что заполнить»);
   услуги — `visibleBusinessServices(core, businessId, { hiddenIds })`.
5. **Публичная страница и виджет — DTO** — `PublicBusinessData` / `OnlineBookingView` отдают `Staff`/`Business` целиком
   (телефон мастера, логин, домашний адрес). Как: `toPublicStaff`, `toPublicBusiness`, `toPublicService`, `toPublicLocation`.
6. **Статусы** — `src/areas/online/booking/BookingConfirmedScreen.tsx:26` своя карта тонов, `:80` свой «отменён»;
   `respondToRequest` `:618` — `changeBookingStatus(id, 'scheduled' | 'cancelled_by_master')` (проверка перехода + права).

## Minor

- `getNearestAvailableDate` `:209`, `getMonthAvailability` `:223`: `new Date(... + 86400000)` → `addDays(date, i)` из `@/lib/date`.
- `src/areas/online/links/copyText.ts` → `copyText` из `@/lib/clipboard` (файл удалить).
- `Business.socials` (k1) пишете вы — клиент читает только поле ядра.
