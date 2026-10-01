# Замечания хранителя ядра · k3 (25.09.2026)

1. **major · Лист ожидания — приёмник заявок** (online F-03-086, client, e2e-q2 №4): нужен `addToWaitlist(...)` в `src/api/resources.ts`;
   сейчас заявки лежат в срезах online и client. «Окно освободилось» — `listBookingEvents({ businessId, freedOnly: true, since })`
   ядра (события пишутся при любой отмене, удалении и переносе, в том числе салоном — C04.S7). ⏳ позже (b01-fix1) — та же большая межразделная работа, что core-rules.md №1; вне 30% времени этой пачки.
2. **minor · Ресурс на время строки** (journal F-01-132): поле `BookingServiceLine.resourceId` — ставьте его во вкладе окна записи.
