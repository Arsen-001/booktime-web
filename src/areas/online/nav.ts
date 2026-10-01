import { countPendingRequests } from '@/api/online';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { SubNav } from '@/config/nav-types';

const OWNER_LIKE = new Set(['owner', 'admin', 'network']);

/** Заявок, ждущих подтверждения — счётчик у «Заявки» в меню (F-00-067, ux-online R2-2) */
function usePendingRequestsCount(): number | undefined {
  const { businessId, staffId, persona, ready } = useCurrent();
  const q = useApiQuery(
    ['online', 'requests', 'count', businessId, persona, staffId],
    () => countPendingRequests(businessId!, OWNER_LIKE.has(persona) ? undefined : staffId),
    { enabled: ready && Boolean(businessId) },
  );
  return q.data;
}

/**
 * Подпункты меню раздела «online». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/online.json → nav.*). На каждый href должна быть страница.
 */
export const subnav: SubNav = {
  online: [
    { id: 'links', href: '/biz/online', labelKey: 'online.nav.links' },
    { id: 'page', href: '/biz/online/page', labelKey: 'online.nav.page' },
    { id: 'widget', href: '/biz/online/widget', labelKey: 'online.nav.widget' },
    { id: 'settings', href: '/biz/online/settings', labelKey: 'online.nav.settings' },
    { id: 'requests', href: '/biz/online/requests', labelKey: 'online.nav.requests', useCount: usePendingRequestsCount },
    { id: 'places', href: '/biz/online/places', labelKey: 'online.nav.places' },
  ],
};
