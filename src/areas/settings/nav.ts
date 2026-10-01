import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «settings». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/settings.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  settings: [
    { id: 'hub', href: '/biz/settings', labelKey: 'settings.nav.hub' },
    {
      id: 'brand',
      href: '/biz/settings/brand',
      labelKey: 'settings.nav.brand',
    },
    {
      id: 'contacts',
      href: '/biz/settings/contacts',
      labelKey: 'settings.nav.contacts',
    },
    {
      id: 'gallery',
      href: '/biz/settings/gallery',
      labelKey: 'settings.nav.gallery',
    },
    {
      id: 'mobileApp',
      href: '/biz/settings/mobile-app',
      labelKey: 'settings.nav.mobileApp',
    },
    {
      id: 'legal',
      href: '/biz/settings/legal',
      labelKey: 'settings.nav.legal',
    },
    {
      id: 'system',
      href: '/biz/settings/system',
      labelKey: 'settings.nav.system',
    },
    {
      id: 'sphere',
      href: '/biz/settings/sphere',
      labelKey: 'settings.nav.sphere',
    },
    {
      id: 'categories',
      href: '/biz/settings/categories',
      labelKey: 'settings.nav.categories',
    },
    {
      id: 'languages',
      href: '/biz/settings/languages',
      labelKey: 'settings.nav.languages',
    },
    {
      id: 'account',
      href: '/biz/settings/account',
      labelKey: 'settings.nav.account',
    },
    {
      id: 'history',
      href: '/biz/settings/history',
      labelKey: 'settings.nav.history',
      permission: 'settings.manage',
    },
    { id: 'help', href: '/biz/settings/help', labelKey: 'settings.nav.help' },
  ],
  billing: [
    {
      id: 'subscription',
      href: '/biz/billing',
      labelKey: 'settings.nav.subscription',
      permission: 'billing.manage',
    },
    {
      id: 'invoices',
      href: '/biz/billing/invoices',
      labelKey: 'settings.nav.invoices',
      permission: 'billing.manage',
    },
    {
      id: 'terms',
      href: '/biz/billing/terms',
      labelKey: 'settings.nav.terms',
      permission: 'billing.manage',
    },
  ],
};
