import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «stock». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/stock.json → nav.*). На каждый href должна быть страница.
 */
// Владелец 17.11.2026 (ответ 17): с правом только «смотреть склад» (без stock.edit) — только товары и остатки, без
// операций, отчётов, «Покупок клиентов» и сумм салона; остальные пункты — со stock.edit (маршруты закрывает StockAccessGate)
export const subnav: SubNav = {
  stock: [
    { id: 'products', href: '/biz/stock', labelKey: 'stock.nav.products' },
    { id: 'warehouses', href: '/biz/stock/warehouses', labelKey: 'stock.nav.warehouses', permission: 'stock.edit' },
    { id: 'techCards', href: '/biz/stock/tech-cards', labelKey: 'stock.nav.techCards', permission: 'stock.edit' },
    { id: 'operations', href: '/biz/stock/operations', labelKey: 'stock.nav.operations', permission: 'stock.edit' },
    { id: 'inventory', href: '/biz/stock/inventory', labelKey: 'stock.nav.inventory', permission: 'stock.edit' },
    // Ск15: «Заказать» (⭐ F-00-137) — раньше попасть можно было только из отчётов
    { id: 'order', href: '/biz/stock/order', labelKey: 'stock.nav.order', permission: 'stock.edit' },
    { id: 'equipment', href: '/biz/stock/equipment', labelKey: 'stock.nav.equipment', permission: 'stock.edit' },
    { id: 'priceTags', href: '/biz/stock/price-tags', labelKey: 'stock.nav.priceTags', permission: 'stock.edit' },
    { id: 'reports', href: '/biz/stock/reports', labelKey: 'stock.nav.reports', permission: 'stock.edit' },
    // ⭐ F-00-142 (b04): напоминания салона и каждого мастера — сверх восьми пунктов Altegio
    { id: 'reminders', href: '/biz/stock/reminders', labelKey: 'stock.nav.reminders' },
    // F-08-001: ТЗ требует ровно 8 пунктов основного списка, «Настройки» — последний из них.
    { id: 'settings', href: '/biz/stock/settings', labelKey: 'stock.nav.settings', permission: 'settings.manage' },
  ],
};
