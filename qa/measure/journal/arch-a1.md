# Архитектура journal · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил). Мерка — docs/ARCHITECTURE.md и CONVENTIONS.md §16.
Сторож: `node scripts/arch-check.mjs --area journal` → 0 error, 28 warn (A10:13, A15:4, A9:3, A7:2, A13:2, A14:2, A11:1, A16:1).
Номера строк — на момент ревью (файлы правятся параллельно, ищите по тексту).

Хорошо: границы чистые (нет чужих импортов, нет стора в экранах, нет `any`), сетка — чистые функции в `lib/grid.ts`,
вклады через `ExtensionSlot`, ключи с префиксом `'journal'`.

## Major

1. **Сохранение записи собирается в компоненте из 8 запросов подряд** — `components/BookingWindow.tsx:396` `handleSave`:
   `hasOverlap` → `isWithinWorkingHours` → `findClientByPhone` → `coreCreate('clients')` → `resolveVisitId` (ещё 1–2 запроса) →
   `createBooking/updateBooking` → `setBookingExtras` → `setBookingBreakOverride`. Каждый — 150–400 мс (в `?api=slow` 1,5–2,5 с):
   «Сохранить» крутится ~2 с, в медленном режиме ~16 с; упадёт на середине — клиент создан, запись нет, или запись есть без
   доп. полей. Бэкенд так не сделать.
   Как: две функции в `src/api/journal.ts`:
   `checkBookingPlacement(input) → { overlap: boolean; outsideHours: boolean }` (для подтверждений в UI) и
   `saveJournalBooking(input) → Booking` — один `request()`: клиент по номеру (найти/завести), визит, запись, extras, перерыв —
   синхронно внутри (нужны синхронные функции ядра — просьба `qa/requests/arch-a1.md` №1). В компоненте — один `useApiMutation`.
   То же для растягивания блока: `components/DayGrid.tsx:90–96` (`hasOverlap` + `updateBooking` из компонента) →
   `resizeBooking(id, durationMin)` с проверкой пересечения внутри, ошибка `ApiError('overlap')`.

2. **Черновик окна пишется в моковую базу каждые 400 мс набора** — `BookingWindow.tsx:256` `saveDraft(...)`. Каждая запись
   поднимает `rev` → перечитываются ВСЕ открытые запросы приложения (сетка журнала, 12 справочников окна) — пока человек
   печатает. После точечной инвалидации всё равно останется лишняя «сетевая» запись на каждое нажатие.
   Как: черновик — клиентское состояние (`sessionStorage` по `draftKey` или zustand-стор раздела в `src/areas/journal/`),
   не `src/api`. Удалить `drafts` из среза, поднять `version`. Заодно уйдут `as unknown as` (`:194`, `:256`) — описать `DraftShape` типом.

3. **Цена со скидкой восстанавливается делением в компоненте** — `BookingWindow.tsx:217`
   `unitPrice = price / qty / (1 - discountPct/100)`: в ядре хранится итог строки, скидка — в срезе journal (`extras.serviceLineExtras`).
   Округление теряет драмы (скидка 33% на 5 000 → 4 999/5 001), а сервер не узнает скидку, не прочитав срез журнала.
   Как: правило — чистая функция `lineTotal({ unitPrice, qty, discountPct })` (просьба `domain/rules/pricing.ts`, пока — в
   `src/domain/journal.ts`), в запись класть `unitPrice` + `discountPct` (просьба в ядро: `BookingServiceLine.unitPrice?`,
   `discountPct?`), итог считать функцией, не хранить отдельно в двух местах. `lib/lineTotals.ts` → туда же.

4. **Своя копия правил записи, расходится с соседями.** `src/api/journal.ts:68` `computeStaffHours` (объединение всех графиков)
   против `src/api/schedule.ts` `effectiveHours/findSchedule` (первый график места); `:113` свой список отменённых статусов;
   `:116` `computeOverlap` — та же занятость, что в `computeFreeSlots`. Запись из журнала и из приложения проверяются разными
   функциями: журнал видит пересечение, которое окно клиенту не видит, и наоборот (запас после услуги учитывает только
   одна сторона). Как: ждать `domain/rules/busy.ts` (`staffDayHours`, `busyIntervals`, `overlaps`) и
   `domain/rules/booking-status.ts` (`isActiveBooking`) — просьба `arch-a1` №2; пока — не расширять свои копии.

5. **Данные «на всех» вместо «на бизнес»** — срез `src/mock/slices/journal.ts:59–71`: `prefs`, `bookingCategories`,
   `customFieldDefs`, `goodsCatalog`, `visitIntervalMin` без `businessId`; ключи `['journal','prefs']`,
   `['journal','booking-categories']`, `['journal','custom-field-defs']`, `['journal','goods-catalog']`
   (`JournalScreen.tsx:62`, `BookingWindow.tsx:133–136`). Владелец стоматологии видит категории и поля маникюрного салона;
   с кэшем TanStack после смены персоны покажутся данные прошлого бизнеса. Как: всё по `businessId` (настройки вида —
   по `staffId`), `getJournalPrefs(businessId, staffId)`, ключи с этими id.

6. **Права: создание проверяется правом редактирования** — `JournalScreen.tsx:43`, `booking-window/ClientZone.tsx:38`:
   `useCan('journal.edit')`, хотя в ядре есть `journal.create` и `journal.reschedule` (ваша же просьба, выполнена k1).
   Перетаскивание/растягивание права `journal.reschedule` не проверяет. Как: `canCreate = useCan('journal.create')`,
   перенос/растягивание — `useCan('journal.reschedule')`; телефон в `BookingHoverCard.tsx:61` — только при `clients.phones`,
   иначе `maskedPhone`.
   ✅ частично исправлено (g2-2) — `canCreate` теперь `useCan('journal.create')` в JournalScreen.tsx и ClientZone.tsx; `journal.reschedule` для переноса/растягивания и `maskedPhone` не сделаны — остаются ⏳.

7. **Дата по UTC** — `components/JournalToolbar.tsx:94–96, 109`: `new Date(...).toISOString().slice(0,10)` — в Ереване «›» не
   двигает день, «Сегодня» до 04:00 открывает вчера (подробно — ux-r1 №1). Как: `toISODate(parse(date).add(n,'day'))`, `today()`.

8. **Сетка дня тянет всю базу клиентов бизнеса** — `JournalScreen.tsx:85` `coreList('clients', { businessId })` ради имён в
   блоках. У салона с 10 000 клиентов это мегабайты на каждый день журнала. Как: одна функция
   `getJournalDay({ businessId, locationIds, date })` → `{ staff, hours, bookings: JournalBookingView[] }`, где у записи уже
   есть `clientName` (коротко, F-01-026), `clientTags`, `serviceNames`; телефон — по праву. Это же заменит 6 запросов экрана одним.

## Minor

9. `BookingWindow.tsx` — 699 строк, 25 `useState` (`:103–130`) и «гидратация во время рендера». Разбить: `useBookingForm`
   (useReducer или react-hook-form), `useBookingCatalogs` (справочники), `BookingWindowFooter`. Цель — < 300 строк на файл.
10. Вкладам не передан `onDraftChange` — `BookingWindow.tsx:593`: скидка лояльности или ресурс не смогут поправить черновик;
    а у новой записи вкладу негде сохранить своё (нет `bookingId`). Нужен договор «после сохранения» — просьба `arch-a1` №9.
11. `lib/categories.ts` — категории клиента по тегам: копия справочника раздела clients (`listCategoryOptions`). Читать
    категории функцией api раздела clients (когда будет), свой список удалить.
12. `lib/status.ts` — свой `BASE_STATUS_META` (тон + иконка статуса), такой же ещё у client (2 копии) и online. Ждать общий
    `BookingStatusBadge` (просьба `arch-a1` №6).
13. Молчаливые ошибки: `BookingWindow.tsx:256, 268, 490, 507` `.catch(() => {})` — хотя бы `console.warn`, для закрепления поля — тост.
14. Ключ `['journal','hours', allStaffIds.join(','), date]` (`JournalScreen.tsx:73`) и `range-load` (`MiniCalendarPanel.tsx:34`)
    — id в строке через запятую: инвалидация по мастеру невозможна. Передавать массив (TanStack хеширует его сам).
15. `resolveVisitId` (`src/api/journal.ts:387`) — отдельный запрос + `coreUpdate` соседней записи: склейка визита не
    атомарна с сохранением. Уйдёт внутрь `saveJournalBooking` (п. 1).
16. `extras.paidAmount`, `goodsLines` — это данные finance и stock. Пока их разделов нет — держать, но пометить в
    `src/domain/journal.ts`, что переедут (оплата — finance через вклад `bookingWindow`, товары — stock).
