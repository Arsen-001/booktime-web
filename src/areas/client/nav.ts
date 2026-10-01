import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «client». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/client.json → nav.*). На каждый href должна быть страница.
 * Верхний пункт `apps` — «Приложения» (src/config/nav.ts), хаб для владельцев.
 */
export const subnav: SubNav = {
  apps: [
    { id: 'hub', href: '/biz/apps', labelKey: 'client.apps.nav.hub' },
    { id: 'stories', href: '/biz/apps/stories', labelKey: 'client.apps.nav.stories' },
    { id: 'news', href: '/biz/apps/news', labelKey: 'client.apps.nav.news' },
    { id: 'promotion', href: '/biz/apps/promotion', labelKey: 'client.apps.nav.promotion' },
    { id: 'reminders', href: '/biz/apps/reminders', labelKey: 'client.apps.nav.reminders' },
    { id: 'branded', href: '/biz/apps/branded', labelKey: 'client.apps.nav.branded' },
    { id: 'translations', href: '/biz/apps/translations', labelKey: 'client.apps.nav.translations' },
  ],
};
