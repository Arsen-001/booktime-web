# Пустые состояния — /biz/stock (empty-d1)

Замер d1 (хранитель демо, 25.09.2026): пустые персоны `?demo=owner&empty=1` («Новый салон — пусто») и `?demo=individual&empty=1` («Новый мастер — пусто») — бизнес без услуг, мастеров, клиентов, записей, графиков. Повторить: `node scripts/measure.mjs --persona owner-empty,individual-empty --routes <адрес> --device phone,desktop --full`. Консоль: 0 ошибок, 0 предупреждений, 0 ответов ≥ 400.

## 1. Экрана нет — пустое состояние проверить нельзя — major
- /biz/stock у обеих пустых персон — заглушка «Раздел «Товары» скоро появится» (телефон и десктоп). Когда экран появится: при пустом бизнесе —
  EmptyState с иконкой, фразой «зачем это» и кнопкой первого действия (CONVENTIONS §0), без таблиц с нулями и фильтров над пустотой.
  Проверка: `node scripts/measure.mjs --persona owner-empty,individual-empty --routes /biz/stock`.
- ✅ исправлено (b01) — на момент stock-b01-fix1 (25.09.2026) экран уже построен: `StockCatalogScreen` показывает
  `EmptyState` «Склад пока пуст» с кнопкой «Добавить товар», без таблицы и фильтров над пустотой; перепроверено
  `node scripts/measure.mjs --persona owner-empty --routes /biz/stock,/biz/stock/warehouses,/biz/stock/equipment,/biz/stock/operations` — 0 ошибок консоли.
