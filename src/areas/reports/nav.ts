import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «reports» (F-12-001, «Готово, когда»: «Основные показатели» · «Записи» ·
 * «События» · «Все отчеты»). «Записи» и «События» открывают тот же generic-экран «Скоро», что и витрина
 * «Все отчеты» — сами отчёты вне пачки b01, но пункт меню обязан быть.
 */
export const subnav: SubNav = {
  reports: [
    { id: 'overview', href: '/biz/reports', labelKey: 'reports.nav.overview' },
    { id: 'visits', href: '/biz/reports/visits', labelKey: 'reports.nav.visits' },
    { id: 'records', href: '/biz/reports/r/appointments', labelKey: 'reports.catalog.items.appointments.title' },
    { id: 'events', href: '/biz/reports/r/events', labelKey: 'reports.catalog.items.events.title', soon: true },
    { id: 'all', href: '/biz/reports/all', labelKey: 'reports.nav.all' },
  ],
};
