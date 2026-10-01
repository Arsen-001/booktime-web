# Архитектура schedule · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил). Мерка — docs/ARCHITECTURE.md и CONVENTIONS.md §16.
Сторож: `node scripts/arch-check.mjs --area schedule` → 0 error, 29 warn (A10:19, A14:3, A8:2, A9:2, A13:1, A11:1, A16:1).
Номера строк — на момент ревью.

Хорошо: `computeFreeSlots` — чистая функция от `CoreData`, пригодна для сервера; массовые правки пишутся одним `coreUpdate`
на сотрудника; «грид»-математика — в `lib/`.

## Major

1. **Неделя часов = 7 запросов подряд** — `CalendarScreen.tsx:76`: `for (const d of dates) out[d] = await getDayHours(staffId, d)`
   внутри fetcher — ~2 с на открытие недели (в `?api=slow` ~14 с) и 7 точек отказа. Как: `getWeekHours(staffId, from, to)` —
   один `request()` (у journal есть такая же, но своя — см. п. 4).
      ✅ исправлено (fix-schedule): getCalendarWeek(staffId, from, to) — один request: часы, тип дня, «дома», отметки, записи, режим, признак «ничего не открыто».

2. **Записи мимо `useApiMutation` и без обработки ошибок** — `CalendarScreen.tsx:97–140`: `changeMode`, `doOpenWholeDay`,
   `addQuickMark`, `doRemoveMark`, `asLastWeek`, `applyVacation` — `await apiFn()` без try/catch: в `?api=error` — необработанный
   отказ промиса, тоста нет, кнопка не крутится. Всего в разделе 19 таких вызовов (A10), ещё `ScheduleScreen.tsx:51, 144, 150`,
   `components/SchedulePanel.tsx:153–184`, `TemplateFormModal.tsx:80`.
   Как: `useApiMutation(fn)` + `try { await m.mutate(...); toast.success } catch { toast.error }`, `loading={m.isPending}`;
   ручные `refreshAll()`/`refetch()` (12) убрать — перечитывание делает слой запросов.
      ✅ исправлено (fix-schedule): во всём разделе записи — useApiMutation + try/catch + тост, ручных refetch/refreshAll нет (arch-check: A10 = 0).

3. **Права по персоне** — `CalendarScreen.tsx:53` `canPickStaff = persona === 'owner' || 'admin' || 'network'`,
   `ScheduleScreen.tsx:42` `restrictedToSelf = persona === 'master'`. Индивидуал (у него есть `staff.view`, но персона не в списке — не может выбрать себя через меню) и админ с
   урезанными галочками получают не то. Как: `useCan('staff.view')` / `useCan('journal.others')` (или новое право
   «график других сотрудников» — просьба в `src/config/permissions.ts`), без `persona`.
      ✅ исправлено (fix-schedule): useCan('journal.others') / useCan('schedule.edit') во всех экранах; в api — assertCanEditSchedule (schedule.edit, чужой график — ещё journal.others). A8 = 0.

4. **Часы мастера на дату считаются в двух разделах по-разному** — `src/api/schedule.ts:165` `effectiveHours` + `findSchedule`
   (первый график места) против `src/api/journal.ts:68` `computeStaffHours` (объединение всех графиков). Журнал и график
   показывают разные часы одному мастеру в филиале сети. Как: вы — хозяин правила: вынести `staffDayHours(core, staffId, date, locationId?)`,
   `busyIntervals`, `isActiveBooking` в общий `domain/rules/` (просьба `arch-a1` №2; хранитель ядра создаёт файл, вы наполняете
   правилом), `computeFreeSlots` перенести туда же, из `src/api/schedule.ts` — реэкспорт (сигнатуры сохранить).
      ✅ исправлено (fix-schedule) (со стороны schedule): getDayHours/getWorkDays/getDayLoad/getScheduledMinutes берут staffDayHours ядра (объединение графиков). ⏳ computeStaffHours в src/api/journal.ts — путь journal.

5. **`computeFreeSlots` не знает половины правил, которые знают соседи**: запас после услуги у **существующих** записей,
   ресурсы, `Staff.onlineBookingEnabled`, отпуск из online (`staffRules.vacationUntil`), время на дорогу для выезда
   (`StaffOnlineRules.travelTimeMin`). Из-за этого online и client дописывают проверки вокруг. Как: `SlotQuery` расширить
   (`workplace`, `serviceId` → буфер и ресурсы) — вы хозяин расчёта; «отпуск» — только тип дня графика (см. online arch-a1 №2).
      ✅ исправлено (fix-schedule) частично: занятость — busyIntervals (запас после чужих записей, та же персона в другом месте, просроченная предоплата), часы — staffWorkIntervals, onlineBookingEnabled, ресурсы. ⏳ позже (fix-schedule) — отпуск из online.staffRules и время на дорогу — поля раздела online, ядро проверяет их в planBooking; перенести в ядро — просьба.

## Minor

6. `src/api/schedule.ts` — 723 строки: окна, таблица, шаблоны, календарь, история. Разбить по смыслу, когда разрешат папку
   `src/api/schedule/` (просьба `arch-a1` №10); до того — хотя бы вынести чистые функции (`datesFor*Template`, `maxCopyToDate`,
   интервалы) в `src/domain/schedule.ts`.
      ✅ исправлено (fix-schedule): папка src/api/schedule/ (slots, demo, packages, table, calendar, series, staff, shared + index.ts), импорт @/api/schedule не менялся.
7. Время в истории — `:203` `new Date().toISOString()` (UTC с `Z`) и `:497` `createdAt` шаблона: формат не `ISODateTime` ядра,
   сортировка вместе с ереванским временем даст сдвиг. Как: `nowDateTime()`.
      ✅ исправлено (fix-schedule): nowDateTime(), createdAt шаблонов — toISODateTime.
8. `writeScheduleOverrides` (`:182`) читает ядро вне `request()` и пишет вторым вызовом — между чтением и записью правка
   другой вкладки потеряется. Внутри одного `request()` + синхронная запись (просьба №1).
      ✅ исправлено (fix-schedule): txWriteOverrides внутри одного request (coreTx.create/update).
9. `:54` свой `INACTIVE` → общий `isActiveBooking` (№2).
      ✅ исправлено (fix-schedule): occupiesTime из @/domain/rules.
10. `if (!ready) return null` (`CalendarScreen.tsx:145`, `ScheduleScreen.tsx:157`) — пустой экран на время загрузки базы;
    показывать `Skeleton` в форме сетки.
       ✅ исправлено (fix-schedule)
11. `getHistory` (`:717`) — тип через `import('@/domain/schedule').HistoryEntry` в сигнатуре; импортировать тип наверху.
       ✅ исправлено (fix-schedule)
12. Ключи с `staffIds.join(',')` нигде, хорошо; `['schedule','calendar-hours', staffId, from, to]` — годится как есть.
