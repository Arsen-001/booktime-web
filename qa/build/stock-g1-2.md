# Пачка g1-2 — раздел «Склад» (сборщик)

Дата: 2026-09-26. Задание проверяющего пропусков: 10 пунктов (arch + F-00-165 + 8 «notOurs»).

## Сделано

### arch — state-s1 п.2 (лишний refetch/onSaved после записи)
Убраны ручные `refetch()`/`onSaved()` после мутаций в местах, где `useApiQuery`-теги уже перекрывают
изменённые коллекции (state-s1 §2 — точечное перечитывание срабатывает само):
- `StockCatalogScreen.tsx` — после `archiveGoods` (`listCategoryTree` читает `goods`) и после
  архивации/удаления категории (читает `categories`).
- `WarehousesScreen.tsx` — `onMoved` у `MoveGoodsModal` убран.
- `MassEditScreen.tsx` — `onSaved` целиком убран (проп и вызов), таблица держит свой локальный `rows`.
- `InventoryDetailScreen.tsx` — 5 мест (`setActual`, `enterAdd`, `confirmReset`, `calculate`,
  `confirmFinalize`).
- `OperationDocScreen.tsx` — 4 места (`removeLine`, `save`, `confirmCancelMove`, `confirmCancelSale`).
- `ErrorState onRetry={...refetch...}` в `OperationFormScreen`/`SaleFormScreen`/`MoveFormScreen`/
  `TechCardFormScreen` — это retry-после-ошибки, НЕ трогал (другой паттерн, легитимный).

Проверено: `listCategoryTree`/`getOperationDoc` читают ровно те коллекции (`goods`/`categories`/
`operations`), которые пишут соответствующие мутации — авто-инвалидация покрывает случай без ручного
`refetch()` (прочитан код `src/api/area.ts`, `docs/STATE.md`).

### arch — своя `lineTotal` вместо правил ядра (`src/api/stock.ts:275`, core-rules major)
Локальная функция `lineTotal` (приход/списание/продажа/документ) переписана на
`applyDiscount` из `@/domain/rules/pricing` (единый источник округления скидки, arch-a1 №3) вместо
собственной формулы `gross - gross*pct/100`.

### F-00-165 — реклама поставщика в «Складе» (В-26)
- Тумблер «Получать предложения поставщиков» — `/biz/stock/settings` (новое поле
  `StockSettings.adsOptIn`, `defaultStockSettings`, `updateStockSettings`; версия среза `stock` поднята
  до 7 — форма данных изменилась).
- Подбор объявления у товара на исходе — `getSupplierOfferForGood(businessId, productName)`
  (`src/api/stock.ts`): читает `pl_stock` из среза `platform` напрямую (разрешено правилом «чужой срез
  можно читать»), гейтится своим `adsOptIn`, а не `platform.bizMeta.adsOptIn` — писать туда может только
  наша панель (`platform.access`), бизнес-персоны такого права не имеют (`src/config/permissions.ts`,
  `ALL_BIZ` его явно исключает). Расхождение и нужный бизнес-доступный сеттер записаны в
  `qa/requests/stock.md`.
- Показ — карточка `SupplierOfferCard` на `/biz/stock/order` (естественное место «рядом с товаром на
  исходе»), показ/клик считает платформа через её `trackAdImpression`/`trackAdClick`.
- Демо-данные уже содержат подходящее объявление (`pl_stock`, сфера `barber`, ключевые слова «крем для
  бритья», «станки» — `src/mock/slices/platform.ts`).

### F-08-137 — источник для приложения клиента
Добавлен `listProductSales(businessId, clientId)` (`src/api/stock.ts`) — построчно по документам
`type: 'sale'` (только продажа в визите, не журнал/склад — как требует 1545). `client` должен заменить
свой заглушечный `BookingProductLine` (`src/domain/client.ts:317`) вызовом этой функции — записано в
`qa/requests/stock.md`, сам экран приложения клиента не строил (не мой путь).

### Остальные 7 «notOurs» (F-08-069, 108, 115, 134, 139, 140, 149)
Экран/место реализации принадлежит `resources`/`reports`/`network`/`staff` — строить там запрещено
(CONVENTIONS §1). Для каждого в `qa/requests/stock.md` записано: что готово со стороны `stock`
(в основном уже существующие функции — `createSaleOperation`, `getStockPermissions`/
`setStockPermissions`, `listOperations`) и что именно нужно построить в чужом разделе. F-08-108/115
дополнительно требуют решения владельца: один источник отчётов склада (наш `/biz/stock/reports` vs
`reports`), сам не выбирал.

## Проверка перед сдачей
- `qa/measure/stock/` (кроме исключённых): `empty-d1.md` — уже ✅ исправлено (b01), `onboarding-k1.md` —
  единственный пункт minor с обоснованным ⏳ позже, block/major без пометки не найдено — новых починок
  не потребовалось.
- `tsc --noEmit --incremental` по своим путям — 0 ошибок.
- `eslint` по изменённым файлам — 0 ошибок/предупреждений.
- `node scripts/check-tokens.mjs --area stock` — 2 находки, обе в `CameraScanner.tsx` (не трогал в этой
  пачке, существовали раньше).
- `scripts/ensure-dev.sh` — сервер уже работал на :3710, не трогал.
- `scripts/measure.mjs` по затронутым маршрутам (`/biz/stock`, `/settings`, `/order`, `/mass-edit`,
  `/warehouses`, `/operations`, `/inventory`), персоны owner (обычная и `sphere=barber`), телефон+десктоп:
  0 ошибок консоли, 0 4xx/5xx, 0 сырых ключей i18n, 0 вылетов, 0 мелких целей.
- Снимки `/biz/stock/settings` и `/biz/stock/order` посмотрены глазами (Read png) — соответствуют
  CONVENTIONS §0 (SectionCard, воздух, EmptyState).

## done
Пункты, где «Готово, когда» выполнено целиком: `arch` (оба подпункта), `F-00-165`.

## partial
- `F-08-069`, `F-08-108`, `F-08-115`, `F-08-134`, `F-08-137`, `F-08-139`, `F-08-140`, `F-08-149` — экран
  функции принадлежит другому разделу (`resources`/`reports`/`network`/`client`/`staff`); со стороны
  `stock` подготовлены и работают нужные api-функции (`createSaleOperation`, `listProductSales`,
  `getStockPermissions`/`setStockPermissions`, `listOperations`), запросы на постройку — в
  `qa/requests/stock.md`. Ни один пункт «Готово, когда» этих функций не выполнен (экрана нет).

## assumed
- `StockSettings.adsOptIn` — своё поле-согласие вместо `platform.bizMeta.adsOptIn`, потому что писать в
  bizMeta бизнес-персона не может (permission-модель); при появлении бизнес-доступного сеттера у
  `platform` это стоит объединить в одну галочку (см. запрос).
- Карточка предложения поставщика размещена на `/biz/stock/order` («заказ поставщику» — самое буквальное
  прочтение «рядом с товаром на исходе»), а не на каждой строке каталога товаров — там таких строк на
  порядок больше и предложение стало бы навязчивым; список кандидатов на заказ уже отфильтрован по
  критичному остатку.
- `listProductSales` фильтрует строго по `type: 'sale'` (не считает `writeoffProduct`/приход/перемещение
  «покупкой клиента») — по тексту F-08-137 (1545) это осознанно у Altegio.

## marked
node scripts/fids.mjs --area stock → **130** (было ниже до пачки; F-00-165 теперь помечен в коде).
