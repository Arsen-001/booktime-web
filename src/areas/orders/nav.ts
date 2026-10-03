import type { SubNav } from '@/config/nav-types';
import { useReadyOrdersCount } from '@/areas/orders/lib/useOrdersData';

/**
 * Подпункты меню раздела «Заказы» (03.10.2026). Файл принадлежит разделу; подписи — messages/<lang>/orders.json → nav.*.
 * У списка — счётчик готовых заказов («Все заказы · 3»): их ждут клиенты.
 */
export const subnav: SubNav = {
  orders: [
    { id: 'list', href: '/biz/orders', labelKey: 'orders.nav.list', useCount: useReadyOrdersCount },
    { id: 'settings', href: '/biz/orders/settings', labelKey: 'orders.nav.settings', permission: 'settings.manage' },
  ],
};
