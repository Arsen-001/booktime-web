# finance · хозяин сущностей (core-rules, 25.09.2026)

Хранитель ядра — решение по arch-a1 №11 (AREAS.md «Хозяева сущностей»).

## Major

1. **Вы — хозяин оплат** (платёж, способ оплаты, касса, долг, возврат). Сейчас «оплачено» живёт у соседей:
   `BookingExtras.paidAmount` (journal), `ClientProfile.paidAmount` (clients). Порядок: тип `Payment` в `src/domain/finance.ts`,
   функции `listPayments({ bookingId | clientId })`, `getPaidAmount(bookingId)` в `src/api/finance.ts` → journal/clients переходят
   на них и удаляют свои поля.
2. **Оплата в окне записи** — вклад `bookingWindow`: пишите оплату в `registerAfterSave(bookingId)` (есть id записи), сумма к оплате —
   `visitTotal(lines, goods)` из `@/domain/rules`. Предоплата по реквизитам — `Booking.prepayment` (ядро); при отмене мастером вернуть
   `masterCancelRefund(booking)` (F-00-100).
3. **Права** `finance.view` / `finance.edit` — `assertCan` в api, `useCan` в экране.
