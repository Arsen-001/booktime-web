# Архитектура finance · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил).
Раздел ещё заглушка (код фундамента ~10–80 строк), поэтому замечаний к коду нет — ниже то, что уже построено соседями
на вашей территории и что нужно учесть с первого файла, чтобы не завести второй источник правды. Общие правила —
docs/ARCHITECTURE.md и CONVENTIONS.md §16; проверка — `node scripts/arch-check.mjs --area finance`.

Первым делом (для всех новых разделов):
- данные среза — по `businessId` (никаких «общих на всех» настроек), ключи — фабрика `financeKeys` с `['finance', …]`;
- одна бизнес-операция = одна функция `src/api/finance.ts` = один `request()`, внутри без `await coreCreate/updateBooking`;
- правила (суммы, сроки, остатки, статусы) — чистые функции в `src/domain/finance.ts`;
- права — `useCan('finance.*')` в экране и проверка в api, не `persona ===`;
- записи — `useApiMutation` + try/catch + тост; списки > 100 — фильтр и пагинация в api.

## Что уже есть у соседей (major — договориться до своих типов)

1. **Оплата визита живёт в срезе journal** — `src/domain/journal.ts:109` `BookingExtras.paidAmount`, кнопка «Оплатить»
   в окне записи (`src/areas/journal/components/BookingWindow.tsx` `handlePay`) пишет только сумму. Хозяин оплаты — вы:
   операции (`FinanceOperation`: касса, метод, сумма, запись) и функция `payVisit(bookingId, method, amount)`; вклад
   `extensions/BookingWindow.tsx` показывает «к оплате / оплачено» из ваших операций. journal удалит `paidAmount`, когда вклад будет.
2. **«Оплачено» у клиента** — `ClientProfile.paidAmount` (clients, ручное поле). Это сумма ваших операций по клиенту;
   дайте `getClientTotals(clientId)` — clients перестанет хранить число.
3. **Предоплата** — `Booking.prepayment` (ядро) + `Staff.prepayment` (ядро, k1) + черновик `prepaymentPolicy` в срезе client.
   Правило «сколько и до какого срока» — общее (`domain/rules/booking-policy.ts`, просьба №3); отметка «оплачено» — ваша операция.
4. Итог визита со скидкой считает journal делением в компоненте — правило цены (`domain/rules/pricing.ts`, просьба №3) нужно и вам:
   не пишите свою формулу итога.
