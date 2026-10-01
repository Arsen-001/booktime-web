import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «schedule». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/schedule.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  schedule: [
    { id: 'table', href: '/biz/schedule', labelKey: 'schedule.nav.table' },
    // Г18: у мастера — «Мой календарь», у тех, кто ведёт график всех, — «Календарь мастера» (своего графика у них нет)
    { id: 'calendar', href: '/biz/schedule/calendar', labelKey: 'schedule.nav.calendar', personas: ['individual', 'master'] },
    { id: 'calendarAll', href: '/biz/schedule/calendar', labelKey: 'schedule.nav.calendarAll', personas: ['owner', 'admin', 'network'] },
    { id: 'templates', href: '/biz/schedule/templates', labelKey: 'schedule.nav.templates' },
    { id: 'slots', href: '/biz/schedule/slots', labelKey: 'schedule.nav.slots' },
    { id: 'series', href: '/biz/schedule/series', labelKey: 'schedule.nav.series' },
    { id: 'history', href: '/biz/schedule/history', labelKey: 'schedule.nav.history' },
  ],
};
