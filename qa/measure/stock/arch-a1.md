# Архитектура stock · arch-a1

Дата: 2026-09-25. Ревьюер архитектуры (код не правил).
Раздел ещё заглушка (код фундамента ~10–80 строк), поэтому замечаний к коду нет — ниже то, что уже построено соседями
на вашей территории и что нужно учесть с первого файла, чтобы не завести второй источник правды. Общие правила —
docs/ARCHITECTURE.md и CONVENTIONS.md §16; проверка — `node scripts/arch-check.mjs --area stock`.

Первым делом (для всех новых разделов):
- данные среза — по `businessId` (никаких «общих на всех» настроек), ключи — фабрика `stockKeys` с `['stock', …]`;
- одна бизнес-операция = одна функция `src/api/stock.ts` = один `request()`, внутри без `await coreCreate/updateBooking`;
- правила (суммы, сроки, остатки, статусы) — чистые функции в `src/domain/stock.ts`;
- права — `useCan('stock.*')` в экране и проверка в api, не `persona ===`;
- записи — `useApiMutation` + try/catch + тост; списки > 100 — фильтр и пагинация в api.

## Что уже есть у соседей (major — договориться до своих типов)

1. **Каталог товаров для продажи в окне записи завёл journal** — `src/domain/journal.ts:81` `GoodsCatalogItem`, сид `goodsCatalog`
   (без `businessId`!) в срезе journal. Хозяин товаров и остатков — вы: `Product` в `src/domain/stock.ts`, `listProducts(businessId)`;
   продажа/списание — ваш вклад `extensions/BookingWindow.tsx`. journal уберёт свой каталог, когда вклад будет.
2. **Покупки товаров клиентом завёл clients** — `src/domain/clients.ts:264` `ProductPurchase` (для фильтра «покупал товар»).
   Дайте `listProductSales(businessId, { clientId? })` — clients перейдёт на неё (просьба №11).
3. **Наличие оттенка при записи** — у client `ShadeOption.availability: 'inStock' | 'onOrder' | 'unavailable'`
   (`src/api/client.ts` `getShadeOptions`), сейчас выдумано из `Service.materials`. Это ваши остатки: функция
   `getMaterialAvailability(serviceId)` — client её вызовет.
4. Техкарта услуги (расходники) — ваш вклад `extensions/ServiceCard.tsx`, данные — в вашем срезе по `serviceId`.
