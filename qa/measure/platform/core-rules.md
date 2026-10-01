# platform · правила — только из ядра (core-rules, 25.09.2026)

Хранитель ядра. Номера строк — на момент 25.09 ~03:10.

## Major

1. **Модерация теперь скрывает** — ядро собирает скрытое из вашего среза: `moderationHiddenIds()` (`@/api/core`) =
   `hiddenByModeration(moderationItems)` (всё не `approved`/`auto`) и передаёт в `staffClientVisibility`, `visibleServices`,
   `toPublic*` (фото на проверке не уходят) и `placeBooking`. Держите `refId` = id сущности (мастер, услуга, бизнес) или
   строка фото, как в `Staff.photos`/`Service.photos`; иначе скрытие не сработает. `isVisibleToClients(refId)` оставьте для экранов панели.
   ✅ исправлено (fix-platform): refId = строка фото ядра; прежние фото тех же мастеров — «одобрено», новое — «на проверке».
2. **Подключение салона одной транзакцией** — `finishConnectDraft` (10 вложенных записей): внутри одного `request()` —
   `coreTx.create('businesses'|'locations'|'staff'|'services'|'schedules', …)` (синхронные двойники ядра, arch-a1 №1).
   Откат при ошибке даст `request()` (архитектор состояния).
   ✅ исправлено (fix-platform): см. arch-a1 №1.

## Minor

- `src/areas/platform/BusinessesScreen.tsx:87` свой CSV/Blob → `toCsv` + `downloadCsv` из `@/lib/csv` (с BOM).
   ✅ исправлено (fix-platform)
- Обзор, где нужны статусы записей — `occupiesTime`, `isCancelled`, `FINAL_STATUSES` из `@/domain/rules`.
   ✅ исправлено (fix-platform): `isCancelled` в `getOverview`.
