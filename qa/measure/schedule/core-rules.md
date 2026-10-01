# schedule · правила — только из ядра (core-rules, 25.09.2026)

Хранитель ядра. Вы — **хозяин окон** (правила слотов F-02). База занятости и часов теперь в ядре
(`src/domain/rules/busy.ts`, `slots.ts`, 72 теста); ваш `computeFreeSlots` накладывает правила слотов поверх неё.
Номера строк — на момент 25.09 ~03:10.

## Major

1. **Занятость — только `busyIntervals()`** — `src/api/schedule.ts:201–216` свой цикл по записям: без запаса после чужой
   записи (F-00-057), без записей той же персоны в другом бизнесе (F-00-045: мастер и в салоне, и дома), истечение предоплаты
   по `createdAt + prepaymentWaitMin` (свой срез). Ядро проверяет запись при создании по `checkSlot` — **окно, показанное
   вашим расчётом, но занятое по ядру, вернёт клиенту «окно уже заняли»**. Как:
   `const busy = busyIntervals(core, q.staffId, q.date, { now: nowISO }).map((b) => [b.from, b.to])`.
   Сделать ДО того, как client/online перейдут на `placeBooking`.
      ✅ исправлено (fix-schedule): busyForSlots = busyIntervals(core, staffId, date, { now }) (+ правило F-02-066 «поверх Не пришёл»).
2. **Часы и отметки — `staffWorkIntervals()`** — `:224–240` свой разбор `overrides/week`, режима «всё занято» и отметок, `openUntil`.
   Как: `staffWorkIntervals(core, staffId, date, { locationId, workplace })` → интервалы с местом; поверх — ваши недоступные дни,
   сетка/плотность, `leadTimeMin`, ресурсы. Свои `subtract/intersect/rangesToIntervals` (`:81–110`) → из `@/domain/rules`.
      ✅ исправлено (fix-schedule): computeFreeSlots строится на staffWorkIntervals; интервалы — из @/domain/rules.
3. **Статусы** — `:70` `INACTIVE`, `:176`, `:394`, `:445`, `:1098` → `occupiesTime(b)` / `isCancelled`.
      ✅ исправлено (fix-schedule): occupiesTime везде, своего INACTIVE нет.
4. **Срок предоплаты — одно поле** — `isPrepaymentExpired` `:185` (свой, по `createdAt` и `prepaymentWaitMin` бизнеса) против
   ядра (`Booking.prepayment.holdUntil`, ставится при создании из `Staff.prepayment.timeoutMin`). Как: `isPrepaymentExpired`
   из `@/domain/rules`; настройку «сколько держится окно» (F-02-071) хранить как дефолт `Staff.prepayment.timeoutMin`
   (просьбой в ядро, если нужен уровень бизнеса), `prepaymentWaitMin` из среза удалить.
      ✅ исправлено (fix-schedule): своя isPrepaymentExpired и prepaymentWaitMin удалены; в настройках — ссылка на предоплату мастера (Staff.prepayment.timeoutMin).
5. **«Сейчас» — Ереван** — `now: Date = new Date()` (`:193`, `:1023`, `:1116`), `new Date().toISOString()` (`:329`, `:623`),
   `toISODate(new Date())` (`:665`) → `nowDateTime()`/`today()`/`addDays` из `@/lib/date` (пояс Asia/Yerevan; `toISOString` сдвигает на 4 ч).
      ✅ исправлено (fix-schedule): nowDateTime()/today()/addDays; new Date/toISOString в разделе нет (A9 = 0).
6. **Проверки по персоне** — `CalendarScreen.tsx:53`, `ScheduleScreen.tsx:42`, `slots/SlotsScreen.tsx:49` → `useCan('schedule.edit')`
   + `can(persona, 'schedule.edit', { actorStaffId, targetStaffId })` из ядра (правка чужого графика).
      ✅ исправлено (fix-schedule): useCan + assertCan/canNow в api.

## Minor

- Сигнатуры `getFreeSlots/getNearestSlots/computeFreeSlots` сохраняйте: `placeBooking` принимает их как
  `isStartOffered: (q) => computeFreeSlots(readCore(), q).some((s) => s.start === q.start)`.
    ✅ исправлено (fix-schedule): сигнатуры сохранены (now — Date | ISODateTime).
- `FreeSlot`/`SlotQuery` в ядре (`@/domain/rules`) — подмножество ваших; расширения (`extra`, `serviceId`, `durationMax`) держите у себя.
