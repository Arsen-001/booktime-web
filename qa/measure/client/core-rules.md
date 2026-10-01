# client · правила — только из ядра (core-rules, 25.09.2026)

Хранитель ядра. Функции ядра готовы и покрыты тестами (`node src/domain/rules/tests/run.mjs` — 72/72).
Импорт: `import { … } from '@/domain/rules'`; команды — `@/api/core`. Номера строк — на момент 25.09 ~03:10 (файлы правятся параллельно).

## Major

1. **Запись из приложения → `placeBooking` / `coreTx.placeBooking`** — `src/api/client.ts:400` `bookAppointment`.
   Сейчас: окно по `service.durationMin` (без «от–до» и запаса), статус всегда «ждёт подтверждения» (игнорирует
   `Staff.confirmMode`), предоплата из черновика `prepaymentPolicy`, `createBooking` вложенным вызовом, `throw new Error`.
   Как: внутри своего `request()`:
   ```ts
   const { booking } = coreTx.placeBooking(
     { source: 'app', businessId, staffId, start, services: [{ serviceId, qty: seats }], client: { appUserId },
       forWhom, visitorName, comment, groupEventId, staffAssignment: 'specific' },
     { isStartOffered: (q) => computeFreeSlots(readCore(), q).some((s) => s.start === q.start) },
   );
   mutateArea('client', (s) => { if (shade) s.bookingShade[booking.id] = shade; });
   ```
   Ошибки — `ApiError(code)`, тексты `common.bookingErrors.<code>` (slot_taken, accepts_mismatch, client_blocked…).
   Срок предоплаты — `booking.prepayment.holdUntil` (ядро), `prepaymentDeadline` в срезе удалить.
2. **Отмена/перенос → ядро** — `src/api/client.ts:711` `cancelBookingByClient` (поздняя отмена ставит `no_show` до визита —
   окно остаётся занятым, противоречит F-00-101), `:727` `rescheduleBookingByClient` (статус всегда «ждёт подтверждения»),
   `:537` `getCancelWindowHours`, `:655` `freeCancelUntil` в `getBooking`.
   Как: `cancelBookingAsClient(bookingId, appUserId)` → `{ booking, late }` (поздно = «Отменил клиент» + неявка),
   `rescheduleBookingAsClient(bookingId, appUserId, start)`; для показа — `effectiveBookingRules(business, staff)`,
   `freeCancelUntil(booking, rules)`, `canReschedule(booking, rules, now)`. Лист ожидания будите после отмены как сейчас.
   Черновик `cancelWindowHours` из среза удалить (поле ядра — `Business/Staff.bookingRules.cancelWindowMin`).
3. **Предоплата** — `src/api/client.ts:551` `releaseExpiredPrepayments` (свой дедлайн в срезе) → `releaseExpiredPrepayments({ appUserId })`
   из `@/api/core` (по `Booking.prepayment.holdUntil`); `markPrepaymentPaid` `:684` — `coreTx.updateBooking` в одном `request()`.
4. **Каталог → правило видимости** — `src/api/client.ts:98` `listCatalog` (inline `calendarVisibility === 'mine'` `:115`,
   без модерации, без `onlineBookingEnabled`, без «пустых» по фото): `isStaffInCatalog(core, staff, { hiddenIds: moderationHiddenIds() })`,
   услуги — `visibleServices(core, staff, { hiddenIds })`. Для окон каталога — длительность `bookedDuration(service)`.
5. **Публичные DTO** — `getMasterCard` `:198`, `getPlaceCard`, `EnrichedBooking` (`:571`), `BookingDetail` (`:622`) отдают
   `Staff`/`Business` целиком: телефон, `login`, `homeAddress`. Как: `toPublicStaff(staff, { hiddenIds, revealHomeAddress:
   canSeeHomeAddress(core, staff.id, { appUserId }) })`, `toPublicBusiness`, `toPublicService`, `toPublicLocation`.
   Телефон мастера — только `PublicStaff.contacts.phone` (когда мастер открыл звонок/WhatsApp), кнопка — `canCallNow(staff, now, busy)`.
6. **Статусы** — свои списки: `src/api/client.ts:591` `CANCELLED_STATUSES`, `:182`; `src/areas/client/home/HomeScreen.tsx:23`
   `ACTIVE_STATUSES`; `src/areas/client/bookings/BookingDetailScreen.tsx:74` `isUpcoming`; тоны — `BookingCard.tsx:15`,
   `BookingDetailScreen.tsx:25`. Как: `ACTIVE_STATUSES`, `isCancelled`, `isUpcoming(b, now)`, `splitClientBookings(list, now)`
   (три списка «Мои записи»), `bookingStatusTone(status, 'client')`. До `ui/BookingStatusBadge` — тон из ядра.

## Minor

- Копирование: `MasterCardScreen.tsx:34` свой `copyText`, `BookingDetailScreen.tsx:116`, `PlaceCardScreen.tsx:62` —
  `copyText` из `@/lib/clipboard`.
- Даты: `dayjs().add(i, 'day')` / `toISODate(dayjs(...))` в api — `addDays(today(), i)` из `@/lib/date` (Ереван, не пояс браузера).
- Черновики `businessSocials`, `shadeRequirement`, `prepaymentPolicy`, `contacts` → поля ядра `Business.socials`,
  `Service.shadeChoice`, `Staff.prepayment`, `Staff.contacts` (контакты заполняет staff, вы только читаете).
- Лист ожидания — хозяин resources (решение ядра, AREAS.md «Хозяева сущностей»): после их api — перейти и удалить `waitlist` из среза.
