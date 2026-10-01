import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «resources». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/resources.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  resources: [
    { id: 'list', href: '/biz/resources', labelKey: 'resources.nav.resources' },
    { id: 'packages', href: '/biz/resources/packages', labelKey: 'resources.nav.packages' },
    { id: 'assistants', href: '/biz/resources/assistants', labelKey: 'resources.nav.assistants' },
  ],
};
