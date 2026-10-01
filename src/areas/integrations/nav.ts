import { countInstalledForBusiness } from '@/api/integrations';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { SubNav } from '@/config/nav-types';

/**
 * Подпункты меню раздела «integrations». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/integrations.json → nav.*). На каждый href должна быть страница.
 */

/** F-13-007: счётчик подключённых у пункта «Установлено» */
function useInstalledCount(): number | undefined {
  const { businessId, ready } = useCurrent();
  const q = useApiQuery(['integrations', 'countInstalled', businessId], () => countInstalledForBusiness(businessId!), { enabled: ready && Boolean(businessId) });
  return q.data;
}

export const subnav: SubNav = {
  integrations: [
    { id: 'catalog', href: '/biz/integrations', labelKey: 'integrations.nav.catalog' },
    { id: 'installed', href: '/biz/integrations/installed', labelKey: 'integrations.nav.installed', useCount: useInstalledCount },
    { id: 'api', href: '/biz/integrations/api', labelKey: 'integrations.nav.api' },
    { id: 'developers', href: '/biz/integrations/developers', labelKey: 'integrations.nav.developers' },
  ],
};
