# Состояние и запросы — schedule (state-s1, 25.09.2026)

Архитектор состояния. Что поменялось — `docs/STATE.md`, правила — CONVENTIONS §18.
Замер `node scripts/renders.mjs --only schedule-busy` («Мой календарь», отметить занято 12:00–13:00):
перерисовок 1318 → 125, перечитано запросов 10 → 4, до тишины 2500 → 460 мс.

## Замечания

1. **major — часы недели читаются семью запросами подряд.** `src/areas/schedule/CalendarScreen.tsx:76`
   `for (const d of dates) out[d] = await getDayHours(staffId, d);` — 7 × 150–400 мс = 1–2,8 с на каждую загрузку и
   каждое перечитывание после записи. Одна функция api `getWeekHours(staffId, from, to)` в одном `request()`.
      ✅ исправлено (fix-schedule)
2. **major — записи прямо в обработчиках, без `useApiMutation` и try/catch** (`CalendarScreen.tsx:98, 113, 122, 127, 132`:
   `setCalendarMode`, `openWholeDay`, `markCalendarRange`, `removeMark`, `copyMarksFromLastWeek`): кнопки не крутят
   загрузку, ошибка — необработанный reject без тоста. И `refreshAll()` после них не нужен — перечитается само.
      ✅ исправлено (fix-schedule)
3. **major — `x!.y` в функции чтения** `src/areas/schedule/slots/components/LiveSlotsDemo.tsx:71–74`
   (`service!.durationMin`, `service!.id`…): под React Compiler поле уходит в рендер и падает, пока `service === undefined`.
   `const svc = service;` → в функции `svc?.durationMin ?? 0` либо значения посчитать в рендере через `?.`.
   Проверка: `node scripts/renders.mjs --check-compiler`.
      ✅ исправлено (fix-schedule): LiveSlotsDemo переписан без `!` (значения в рендере через ?.).
4. **major — api работает с базой вне `request()`:** `setCells` (`src/api/schedule.ts:475`, `readCore()` в цикле и
   `mutateArea` + `pushHistory`), `writeScheduleOverrides`, `markCalendarRange` (`readCore()` до `addMark`): без задержки и
   режима ошибок «сети», не откатываются при ошибке посередине, до подъёма базы видят пустые данные. В деве —
   `[mock-db] обращение к базе вне request()` (сценарий `schedule-set-cell` — 4 места). Тело — в один синхронный `request()`.
      ✅ исправлено (fix-schedule): все записи — синхронно внутри одного request (txSetCells, txWriteOverrides, marks).
