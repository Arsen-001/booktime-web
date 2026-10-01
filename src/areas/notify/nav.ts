import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «notify». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/notify.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  notifications: [
    { id: 'types', href: '/biz/notifications', labelKey: 'notify.nav.types' },
    { id: 'channels', href: '/biz/notifications/channels', labelKey: 'notify.nav.channels' },
    { id: 'mailings', href: '/biz/notifications/mailings', labelKey: 'notify.nav.mailings', permission: 'notify.mailings' },
    { id: 'log', href: '/biz/notifications/log', labelKey: 'notify.nav.log', permission: 'notify.log' },
    { id: 'inbox', href: '/biz/notifications/inbox', labelKey: 'notify.nav.inbox' },
  ],
};
