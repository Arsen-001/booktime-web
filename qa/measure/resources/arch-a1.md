# Архитектура resources · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил).
Раздел ещё заглушка (код фундамента ~10–80 строк), поэтому замечаний к коду нет — ниже то, что уже построено соседями
на вашей территории и что нужно учесть с первого файла, чтобы не завести второй источник правды. Общие правила —
docs/ARCHITECTURE.md и CONVENTIONS.md §16; проверка — `node scripts/arch-check.mjs --area resources`.

Первым делом (для всех новых разделов):
- данные среза — по `businessId` (никаких «общих на всех» настроек), ключи — фабрика `resourcesKeys` с `['resources', …]`;
- одна бизнес-операция = одна функция `src/api/resources.ts` = один `request()`, внутри без `await coreCreate/updateBooking`;
- правила (суммы, сроки, остатки, статусы) — чистые функции в `src/domain/resources.ts`;
- права — `useCan('resources.*')` в экране и проверка в api, не `persona ===`;
- записи — `useApiMutation` + try/catch + тост; списки > 100 — фильтр и пагинация в api.

## Что уже есть у соседей (major — договориться до своих типов)

1. **Свободен ли ресурс** — у journal своя `computeResourceFree` (`src/api/journal.ts` ~`:147`), а `computeFreeSlots` (schedule)
   ресурсы не учитывает. Хозяин правила — вы: чистая функция `resourceBusy(core, resourceId, date)` в `src/domain/resources.ts`
   или в общем `domain/rules/busy.ts` (просьба №2); journal и schedule перейдут на неё.
   ✅ исправлено (b01-fix1) — канонические `instanceBusy/pickFreeInstances/checkInstancesFree` уже были в
   `src/domain/resources.ts`, но нигде не вызывались; подключил их в `src/domain/rules/booking-flow.ts` (`planBooking`
   теперь сам подбирает/проверяет `resourceIds` для журнала и `placeBooking`), `src/api/online.ts` (виджет —
   `pickFreeResourceInstances`) и `src/areas/resources/EventCreateScreen.tsx` (событие). `journal` и
   `schedule/slots.ts` на неё ещё не перешли (не мой путь) — записал `qa/requests/resources.md`
   (2026-09-26 · b01-fix1: `resourcesAvailable` в `schedule/slots.ts` вдобавок сравнивает не тот id).
2. **Групповые события** — в ядре (`createGroupEvent/listGroupEvents`, k1). Не заводите свою коллекцию событий.
3. **Лист ожидания** — клиентская часть уже есть у client (`WaitlistEntry` в срезе client, `addToWaitlist`, уведомление при
   отмене). Экран `/biz/waitlist` — ваш: читайте лист функцией api client (или договоритесь о переносе в ядро — просьба №12),
   не второй список.
