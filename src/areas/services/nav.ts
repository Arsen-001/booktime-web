import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «services». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/services.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  services: [
    { id: 'catalog', href: '/biz/services', labelKey: 'services.nav.catalog' },
    {
      id: 'photos',
      href: '/biz/services/photos',
      labelKey: 'services.nav.photos',
    },
    {
      id: 'documents',
      href: '/biz/services/documents',
      labelKey: 'services.nav.documents',
    },
    {
      id: 'materials',
      href: '/biz/services/materials',
      labelKey: 'services.nav.materials',
    },
  ],
};
