# Архитектура payroll · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил).
Раздел ещё заглушка, замечаний к коду нет. Общие правила — docs/ARCHITECTURE.md и CONVENTIONS.md §16;
проверка — `node scripts/arch-check.mjs --area payroll`.

Первым делом:
- данные среза — по `businessId`, ключи — фабрика `payrollKeys` с `['payroll', …]`;
- расчёт зарплаты за день/период — чистая функция `computePayroll(scheme, visits, bonuses)` в `src/domain/payroll.ts`,
  api собирает входы и возвращает готовые строки; компонент ничего не суммирует;
- одна операция = одна функция api = один `request()`; права — `useCan('payroll.view' | 'payroll.manage')`.

## Что учесть у соседей

1. **База расчёта — визиты и оплаты.** «Пришёл» — одно определение для всех (`domain/rules/booking-status.ts`, просьба
   `qa/requests/arch-a1.md` №2); сумма услуги со скидкой — `domain/rules/pricing.ts` (просьба №3): journal сейчас хранит итог
   строки в ядре, а скидку — в своём срезе; не пишите третью формулу.
2. **Мастер строки услуги** — `BookingServiceLine.staffId` (у записи может быть несколько мастеров) — считайте по строкам, не по `Booking.staffId`.
3. Схема расчёта мастера — ваш вклад `staffCard`, процент по услуге — вклад `serviceCard`; данные — в вашем срезе по `staffId`/`serviceId`.
