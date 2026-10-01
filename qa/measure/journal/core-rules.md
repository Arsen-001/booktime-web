# journal · правила — только из ядра (core-rules, 25.09.2026)

Хранитель ядра. Функции — `@/domain/rules` (чистые, 72 теста), команды — `@/api/core`. Номера строк — на момент 25.09 ~03:10.

## Major

1. **Сохранение записи → одна команда `placeBooking`** — `src/areas/journal/components/BookingWindow.tsx:436–486`:
   `hasOverlap` + `isWithinWorkingHours` + `createBooking` + extras подряд из компонента. Как:
   `placeBooking({ source: 'journal', businessId, staffId, start, services: lines.map((l) => ({ serviceId, staffId, qty,
   discountPct, unitPrice })), client: { clientId } | { phone, name }, status, resourceIds, visitId, seriesId })`.
   Ядро проверяет право `journal.create`, двойную запись (F-00-045, запас не учитывается — как у Altegio), «вне часов»
   РАЗРЕШАЕТ (предупреждение — ваше: `checkSlot(core, { …, checkPast: false }, now).reason === 'outside_hours'`), ставит
   `createdBy` по текущему сотруднику. Код `outside_hours` не придёт — его показывает окно заранее.
   Правка существующей записи — пока `updateBooking`; вклады — через договор сохранения (ниже, №4).
2. **Пересечения и часы → ядро** — `src/api/journal.ts:113` `INACTIVE`, `:116` `computeOverlap`, `:68` `computeStaffHours`,
   `:147` `computeResourceFree`, `:193`/`:371` свои фильтры статусов. Как: `hasBookingOverlap(core, staffId, start, dur, excludeId)`,
   `staffDayHours(core, staffId, date, locationId?)` (объединение графиков — ваше решение стало правилом ядра),
   `occupiesTime(b)`, `dayBreaks(hours)`. Домашние записи мастера в салонной сетке — `busyForViewer(busyIntervals(core,
   staffId, date), { businessId, staffIds: [мой staffId] })` → чужое как «занято · дома» без имени и суммы (F-00-046).
3. **Цена со скидкой без деления** — `BookingWindow.tsx:218–219` восстанавливает цену делением `s.price / (1 - pct)` (теряются
   драмы). В ядре у строки есть `unitPrice` и `discountPct`: строка — `makeServiceLine(service, staffId, { qty, discountPct,
   unitPrice })`, показ — `lineUnitPrice/lineTotal/lineDiscount`, итог — `visitTotal(lines, goods)`. `serviceLineExtras.discountPct`
   в срезе удалить после перехода.
4. **Договор вкладов окна записи** (`src/extensions/types.ts`, `src/extensions/saveHooks.ts`) — `BookingWindow.tsx:600`
   не передаёт `onDraftChange`. Передайте `onDraftChange`, `registerBeforeSave`, `registerAfterSave` из `useSaveSteps()` и
   вызывайте `runBefore(draft)` до своей мутации и `runAfter(booking.id, draft)` после. `ExtensionSlot` уже ловит ошибки вклада.
5. **Статус и неявки** — `BookingHoverCard.tsx:38` и кнопки статуса (`StatusButtons.tsx`) ставят `setBookingStatus` без проверки и без
   счётчика неявок. Как: `changeBookingStatus(id, status)` (+1/−1 к `Client.noShowCount`, право `journal.edit`, на чужую запись —
   `journal.others`); список/тон/значок — `BOOKING_STATUSES`, `BOOKING_STATUS_META`, `nextStatuses(from, 'business')`
   (`src/areas/journal/lib/status.ts` оставить только для «пришёл, не оплачено» и цвета шапки; `isOnlineSource` — из ядра).
6. **Права, которые не проверяются нигде** — `journal.create` (клик по ячейке, «Новая запись»), `journal.reschedule` (перетаскивание,
   растягивание — `DayGrid.tsx:90`): `useCan` в экране + ядро проверяет в `placeBooking`/`changeBookingStatus`.

## Minor

- `BookingHoverCard.tsx:61` `navigator.clipboard` → `copyText` из `@/lib/clipboard`.
- Каталог «Продать ▾» (`GoodsCatalogItem`, `getGoodsCatalog`) и «оплачено» (`BookingExtras.paidAmount`) — не ваши сущности
  (AREAS.md «Хозяева сущностей»: товары — stock, абонементы/сертификаты — loyalty, оплаты — finance). Когда хозяева дадут
  функции чтения — перейти и удалить свои. `CustomFieldDef` (поля записи) → переименовать в `BookingFieldDef`.
