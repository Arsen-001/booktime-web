# Архитектура settings · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил).
Раздел ещё заглушка (код фундамента ~10–80 строк), поэтому замечаний к коду нет — ниже то, что уже построено соседями
на вашей территории и что нужно учесть с первого файла, чтобы не завести второй источник правды. Общие правила —
docs/ARCHITECTURE.md и CONVENTIONS.md §16; проверка — `node scripts/arch-check.mjs --area settings`.

Первым делом (для всех новых разделов):
- данные среза — по `businessId` (никаких «общих на всех» настроек), ключи — фабрика `settingsKeys` с `['settings', …]`;
- одна бизнес-операция = одна функция `src/api/settings.ts` = один `request()`, внутри без `await coreCreate/updateBooking`;
- правила (суммы, сроки, остатки, статусы) — чистые функции в `src/domain/settings.ts`;
- права — `useCan('settings.*')` в экране и проверка в api, не `persona ===`;
- записи — `useApiMutation` + try/catch + тост; списки > 100 — фильтр и пагинация в api.

## Что уже есть у соседей (major — договориться до своих типов)

1. **Правила отмены/переноса** — `Business.bookingRules` в ядре пишет online; не заводите второй экран с теми же полями —
   хаб настроек показывает вклад online (`settingsHub`).
2. **Промокоды подписки, бесплатный месяц, монеты** — данные у platform (`PromoCode`, `FreeMonthGrant`, `CoinEntry`).
   Экран «Подписка» и «Монеты» читает их функциями `src/api/platform.ts` (`validatePromo`, `redeemPromo`, …), баланс монет —
   сумма `CoinEntry` (docs/backend/06-moderation-coins-billing.md), не отдельное число.
3. Настройки компании «на всех» уже завели journal и clients (категории, поля, колонки без `businessId`) — у вас так не делать:
   всё по `businessId`.
