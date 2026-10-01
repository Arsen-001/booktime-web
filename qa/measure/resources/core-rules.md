# resources · хозяин сущностей (core-rules, 25.09.2026)

Хранитель ядра — решение по arch-a1 №11–12 (AREAS.md «Хозяева сущностей»).

## Major

1. **Лист ожидания — ваш** (F-00-102, F-16): сейчас `waitlist` живёт в срезе client (`src/mock/slices/client.ts`,
   `addToWaitlist/listMyWaitlist/removeFromWaitlist` в `src/api/client.ts`). Заведите тип и api (`addToWaitlist`, `listWaitlist({ businessId |
   appUserId })`, `notifyFreedSlot(staffId, date, serviceId)`) — client и notify вызывают вас; «окно освободилось» считает ядро
   (отмена/перенос: `cancelBookingAsClient`, `coreTx.cancelByClient` возвращают запись — зовите `notifyFreedSlot` после).
   ⏳ позже — уже начато (`qa/requests/resources.md` 2026-09-25 «Лист ожидания живёт в ДВУХ местах»: моя чистая
   реализация в `src/domain/resources.ts`/`src/api/resources.ts` для `/biz/waitlist` готова), но слияние с
   client-стороной и `notifyFreedSlot(...)`, вызываемый из `cancelBookingAsClient`/`coreTx.cancelByClient`, —
   отдельная межразделная пачка (не влезает в 30% времени b01-fix1, который чинит занятость ресурса и
   участников события).
2. **Групповые события** — места считает ядро (`placeBooking` → `group_full`), занятость мастера событием — `busyIntervals`.
   Свободен ли экземпляр ресурса — пока `computeResourceFree` у journal; общее правило ресурсов — просьбой в ядро, когда начнёте.
   ✅ исправлено (b01-fix1) — `placeBooking`/`planBooking` теперь сам подбирает свободные экземпляры ресурсов для
   строк события (через `pickFreeInstances`), а `EventCreateScreen` подбирает их для самого события при создании;
   `group_full` (места) не трогал — уже было верно. `journal`'ья `computeResourceFree` остаётся дублем — не мой
   путь, см. `qa/requests/resources.md`.
