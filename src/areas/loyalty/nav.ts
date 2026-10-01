import { countPendingPurchaseRequests } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { SubNav } from '@/config/nav-types';

/** Заявок на покупку в приложении, ждущих решения — счётчик у «Заявки на покупку» (В-17) */
function usePendingPurchaseRequestsCount(): number | undefined {
  const { businessId, ready } = useCurrent();
  const q = useApiQuery(['loyalty', 'appPurchaseRequests', 'count', businessId], () => countPendingPurchaseRequests(businessId!), {
    enabled: ready && Boolean(businessId),
  });
  return q.data;
}

/**
 * Подпункты меню раздела «loyalty». Файл принадлежит разделу: добавляйте, убирайте, переименовывайте
 * (ключи подписей — в messages/<lang>/loyalty.json → nav.*). На каждый href должна быть страница.
 */
// F-06-003: пункты меню «Лояльность» и «Счета клиентов» кабинета сети, видны по праву 'loyalty.manage'.
export const subnav: SubNav = {
  loyalty: [
    { id: 'hub', href: '/biz/loyalty', labelKey: 'loyalty.nav.hub' },
    {
      id: 'appPurchases',
      href: '/biz/loyalty/purchase-requests',
      labelKey: 'loyalty.nav.appPurchases',
      permission: 'loyalty.manage',
      useCount: usePendingPurchaseRequestsCount,
    },
    { id: 'cardTypes', href: '/biz/loyalty/card-types', labelKey: 'loyalty.nav.cardTypes', permission: 'loyalty.manage' },
    { id: 'cards', href: '/biz/loyalty/cards', labelKey: 'loyalty.nav.cards', permission: 'loyalty.manage' },
    { id: 'promotions', href: '/biz/loyalty/promotions', labelKey: 'loyalty.nav.promotions', permission: 'loyalty.manage' },
    { id: 'autoApply', href: '/biz/loyalty/auto-apply', labelKey: 'loyalty.nav.autoApply', permission: 'loyalty.manage' },
    { id: 'transactions', href: '/biz/loyalty/transactions', labelKey: 'loyalty.nav.transactions', permission: 'loyalty.manage' },
    { id: 'referral', href: '/biz/loyalty/referral', labelKey: 'loyalty.nav.referral', permission: 'loyalty.manage' },
    { id: 'certificateTypes', href: '/biz/loyalty/certificates/types', labelKey: 'loyalty.nav.certificateTypes', permission: 'loyalty.manage' },
    { id: 'certificates', href: '/biz/loyalty/certificates', labelKey: 'loyalty.nav.certificates', permission: 'loyalty.manage' },
    { id: 'membershipTypes', href: '/biz/loyalty/memberships/types', labelKey: 'loyalty.nav.membershipTypes', permission: 'loyalty.manage' },
    { id: 'memberships', href: '/biz/loyalty/memberships', labelKey: 'loyalty.nav.memberships', permission: 'loyalty.manage' },
    { id: 'depositTypes', href: '/biz/loyalty/deposits/types', labelKey: 'loyalty.nav.depositTypes', permission: 'loyalty.manage' },
    { id: 'deposits', href: '/biz/loyalty/deposits', labelKey: 'loyalty.nav.deposits', permission: 'loyalty.manage' },
    { id: 'depositOperations', href: '/biz/loyalty/deposits/operations', labelKey: 'loyalty.nav.depositOperations', permission: 'loyalty.manage' },
    { id: 'onlineSales', href: '/biz/loyalty/online-sales', labelKey: 'loyalty.nav.onlineSales', permission: 'loyalty.manage' },
  ],
};
