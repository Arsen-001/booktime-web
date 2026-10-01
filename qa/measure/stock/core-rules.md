# stock · хозяин сущностей (core-rules, 25.09.2026)

Хранитель ядра — решение по arch-a1 №11 (AREAS.md «Хозяева сущностей»).

## Major

1. **Вы — хозяин товаров, остатков и продаж товаров.** Сейчас: `GoodsCatalogItem` kind `product` и `getGoodsCatalog()` —
   journal (`src/domain/journal.ts:79`, каталог без `businessId`); `ProductPurchase` — clients (`src/domain/clients.ts:264`).
   Порядок: тип товара и продажи в `src/domain/stock.ts`, функции `listProducts(businessId)`, `listProductSales({ clientId | bookingId })`
   в `src/api/stock.ts` → journal («Продать ▾», F-01-010) и clients (фильтры «По продажам») переходят на них.
2. **Расходники в окне записи** — вклад `bookingWindow`, списание — в `registerAfterSave(bookingId)`. Итог строки товара —
   `visitTotal(lines, goods)` из `@/domain/rules`.
