'use client';

/**
 * F-08-109…118: мелкое право «Товары» текущего сотрудника. Ядро знает только stock.view/stock.edit
 * (грубо); здесь — надстройка поверх своего среза (просьба фундаменту — qa/requests/stock.md). Галочки
 * для конкретного сотрудника рисует staff (F-10-079), эти права только читаются и проверяются здесь.
 */
import { getStockPermissions } from '@/api/stock';
import { useApiQuery } from '@/api/request';
import { useCan, useCurrent } from '@/demo/hooks';
import { defaultStockPermissions, type StockStaffPermissions } from '@/domain/stock';

export function useStockPermissions(): StockStaffPermissions {
  const { businessId, staffId } = useCurrent();
  const edit = useCan('stock.edit');
  const view = useCan('stock.view');
  const q = useApiQuery(['stock', 'permissions', businessId, staffId], () => getStockPermissions(businessId!, staffId!), { enabled: Boolean(businessId) && Boolean(staffId) });
  const fine = q.data ?? defaultStockPermissions({ edit, view });
  // Грубое право строже тонких (нет stock.edit — например, подписка заморожена, кабинет «только просмотр»):
  // приход, списание, перемещение, инвентаризация и товары закрыты, просмотр остаётся
  if (edit || !q.data) return fine;
  return {
    ...fine,
    canCreateOps: false,
    canEditOps: false,
    canDeleteOps: false,
    canMoveOps: false,
    inventoryCreate: false,
    inventoryEdit: false,
    inventoryDelete: false,
    manageGoods: false,
    bookingWindowEdit: false,
    techCardEdit: false,
  };
}
