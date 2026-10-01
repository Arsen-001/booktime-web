import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «clients». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/clients.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  clients: [
    { id: 'base', href: '/biz/clients', labelKey: 'clients.nav.base' },
    { id: 'summary', href: '/biz/clients/summary', labelKey: 'clients.nav.summary' },
    { id: 'categories', href: '/biz/clients/categories', labelKey: 'clients.nav.categories' },
    { id: 'loyalty', href: '/biz/clients/loyalty', labelKey: 'clients.nav.loyalty' },
    { id: 'import', href: '/biz/clients/import', labelKey: 'clients.nav.import' },
    { id: 'log', href: '/biz/clients/log', labelKey: 'clients.nav.log' },
    { id: 'integrations', href: '/biz/clients/integrations', labelKey: 'clients.nav.integrations' },
  ],
};
