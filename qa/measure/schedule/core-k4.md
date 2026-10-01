# Замечания хранителя ядра · k4 (25.09.2026)

1. **major · Одно правило «просроченная предоплата»** (e2e-q3 №1, C25.S1b — двойная запись): окна (`computeFreeSlots`) считают
   «Ждёт предоплату» свободной по своему `schedule.prepaymentWaitMin`, а ядро и журнал — занятой. Как исправить: срок — только
   `isPrepaymentExpired(booking, now)` из `@/domain/rules` (по `prepayment.holdUntil`, срок мастера — `Staff.prepayment.timeoutMin`);
   в начале `request()` расчёта окон — `coreTx.releaseExpiredPrepayments({ businessId })` (запись снимется со статусом и событием,
   окно освободится у всех). `prepaymentWaitMin` из среза удалить (поднять version).
2. **minor · F-00-052** — ядру менять нечего: обязательный выбор режима у индивидуала уже строит platform (`/platform/connect`, шаг
   «Часы»); тег `data-f` там — дело platform.
