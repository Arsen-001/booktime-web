# Замечания хранителя ядра · k3 (25.09.2026)

1. **major · Серия — одна команда** (e2e-q2 №7, C08.S2–S3): `createRecurrenceSeries` — цикл `await coreCreate`, статус всегда
   `scheduled`, без `appUserId`. Перейти на `createSeries` раздела schedule (поверх `coreTx.placeBooking`, один `request()`), с исходной
   записи переносить `appUserId` и `source`.
2. **minor · Новое в ядре для вас:** право `journal.stats` (гейт «Сводки дня» вместо `journal.others`); `requestSync()` из
   `@/api/request` для `flushDraftSync`; `parseCsv` / `readTextFile` из `@/lib/csv` для «Загрузить из Excel»; `logDataOperation` —
   общий журнал операций вместо `dataOpsLog`; `BookingServiceLine.resourceId` (F-01-132); `Service.servicePackage` (пакет).
3. **minor · Домашняя запись мастера** (e2e-q2 №8, C07): занятость чужого места — `busyForViewer` из `@/domain/rules` («занято · дома»
   без имени), до переноса графика в сиде (`seed-pending.md` §7).
