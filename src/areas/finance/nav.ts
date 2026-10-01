import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «finance». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/finance.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  finance: [
    { id: 'operations', href: '/biz/finance', labelKey: 'finance.nav.operations' },
    { id: 'accounts', href: '/biz/finance/accounts', labelKey: 'finance.nav.accounts' },
    // Владелец, 01.10.2026: смену ведёт администратор (finance.shift) — отдельная страница без остальных финансов
    { id: 'shift', href: '/biz/finance/shift', labelKey: 'finance.nav.shift', permission: 'finance.shift' },
    { id: 'account-types', href: '/biz/finance/account-types', labelKey: 'finance.nav.accountTypes' },
    { id: 'items', href: '/biz/finance/items', labelKey: 'finance.nav.items' },
    { id: 'counterparties', href: '/biz/finance/counterparties', labelKey: 'finance.nav.counterparties' },
    { id: 'documents', href: '/biz/finance/documents', labelKey: 'finance.nav.documents' },
    { id: 'reports', href: '/biz/finance/reports', labelKey: 'finance.nav.reports' },
    { id: 'methods', href: '/biz/finance/methods', labelKey: 'finance.nav.methods' },
    { id: 'online', href: '/biz/finance/online', labelKey: 'finance.nav.online' },
    { id: 'policy', href: '/biz/finance/policy', labelKey: 'finance.nav.policy' },
    { id: 'settings', href: '/biz/finance/settings', labelKey: 'finance.nav.settings' },
    { id: 'settlements', href: '/biz/finance/settlements', labelKey: 'finance.nav.settlements' },
  ],
};
