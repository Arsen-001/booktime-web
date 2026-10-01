'use client';

/**
 * /biz/loyalty/online-sales/orders — F-06-152: обработка заказов витрины онлайн-продаж без платёжной
 * системы («Другой способ», F-06-148) — «Ждёт оплаты» → «Подтвердить» (выпускает сертификат/абонемент,
 * F-06-151) / «Отклонить»; у подтверждённых — «Возврат».
 */
import { useState } from 'react';
import { Check, ShoppingBag, Undo2, X } from 'lucide-react';
import { confirmOnlineOrder, listOnlineOrders, rejectOnlineOrder, refundOnlineOrder } from '@/api/loyalty';
import type { OnlineOrder, OnlineOrderStatus } from '@/domain/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FilterBar } from '@/ui/FilterBar';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { Table, type TableColumn } from '@/ui/Table';
import { useConfirm, useToast } from '@/ui/Toast';

const STATUS_TONE: Record<OnlineOrderStatus, BadgeTone> = { pendingPayment: 'warning', confirmed: 'success', rejected: 'neutral', refunded: 'danger' };

export function OnlineSalesOrdersScreen() {
  const t = useT('loyalty');
  const format = useFormat();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const { ready, businessId } = useCurrent();
  const [status, setStatus] = useState<OnlineOrderStatus | ''>('');

  const q = useApiQuery(['loyalty', 'onlineOrders', businessId, status], () => listOnlineOrders(businessId!, { status: status || undefined }), {
    enabled: ready && Boolean(businessId),
  });

  const confirmMutation = useApiMutation((id: string) => confirmOnlineOrder(businessId!, id));
  const rejectMutation = useApiMutation((id: string) => rejectOnlineOrder(businessId!, id));
  const refundMutation = useApiMutation((id: string) => refundOnlineOrder(businessId!, id));

  const onConfirm = async (order: OnlineOrder) => {
    try {
      await confirmMutation.mutate(order.id);
      toast.success(t('onlineSales.orders.confirmed'));
      q.refetch();
    } catch {
      toast.error(t('onlineSales.orders.actionFailed'));
    }
  };
  const onReject = async (order: OnlineOrder) => {
    const ok = await confirmDialog({ title: t('onlineSales.orders.rejectConfirmTitle'), description: t('onlineSales.orders.rejectConfirmText'), tone: 'danger' });
    if (!ok) return;
    try {
      await rejectMutation.mutate(order.id);
      toast.success(t('onlineSales.orders.rejected'));
      q.refetch();
    } catch {
      toast.error(t('onlineSales.orders.actionFailed'));
    }
  };
  const onRefund = async (order: OnlineOrder) => {
    const ok = await confirmDialog({ title: t('onlineSales.orders.refundConfirmTitle'), description: t('onlineSales.orders.refundConfirmText'), tone: 'danger' });
    if (!ok) return;
    try {
      await refundMutation.mutate(order.id);
      toast.success(t('onlineSales.orders.refunded'));
      q.refetch();
    } catch {
      toast.error(t('onlineSales.orders.actionFailed'));
    }
  };

  const columns: TableColumn<OnlineOrder>[] = [
    { id: 'createdAt', header: t('onlineSales.orders.columns.date'), cell: (r) => format.dateTime(r.createdAt), mobile: 'meta' },
    { id: 'itemName', header: t('onlineSales.orders.columns.item'), cell: (r) => r.itemName, mobile: 'title' },
    { id: 'client', header: t('onlineSales.orders.columns.client'), cell: (r) => `${r.clientName} · ${r.clientPhone}`, mobile: 'meta' },
    { id: 'price', header: t('onlineSales.orders.columns.price'), cell: (r) => format.money(r.price), align: 'right', mobile: 'meta' },
    { id: 'status', header: t('onlineSales.orders.columns.status'), cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{t(('onlineSales.orders.status.' + r.status) as 'onlineSales.orders.status.pendingPayment')}</Badge>, mobile: 'meta' },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (r) =>
        r.status === 'pendingPayment' ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" leftIcon={<Check aria-hidden />} loading={confirmMutation.isPending} onClick={() => onConfirm(r)}>
              {t('onlineSales.orders.confirm')}
            </Button>
            <Button size="sm" variant="outline" leftIcon={<X aria-hidden />} loading={rejectMutation.isPending} onClick={() => onReject(r)}>
              {t('onlineSales.orders.reject')}
            </Button>
          </div>
        ) : r.status === 'confirmed' ? (
          <Button size="sm" variant="outline" leftIcon={<Undo2 aria-hidden />} loading={refundMutation.isPending} onClick={() => onRefund(r)}>
            {t('onlineSales.orders.refund')}
          </Button>
        ) : null,
    },
  ];

  return (
    <div data-f="F-06-152" className="flex flex-col gap-6">
      <PageHeader title={t('onlineSales.orders.title')} description={t('onlineSales.orders.description')} />
      <FilterBar
        filters={[
          {
            id: 'status',
            label: t('onlineSales.orders.filterStatus'),
            node: (
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as OnlineOrderStatus | '')}
                options={[
                  { value: '', label: t('onlineSales.orders.allStatuses') },
                  { value: 'pendingPayment', label: t('onlineSales.orders.status.pendingPayment') },
                  { value: 'confirmed', label: t('onlineSales.orders.status.confirmed') },
                  { value: 'rejected', label: t('onlineSales.orders.status.rejected') },
                  { value: 'refunded', label: t('onlineSales.orders.status.refunded') },
                ]}
              />
            ),
          },
        ]}
      />
      {q.isLoading ? null : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !q.data?.length ? (
        <EmptyState icon={<ShoppingBag aria-hidden />} title={t('onlineSales.orders.emptyTitle')} description={t('onlineSales.orders.emptyText')} />
      ) : (
        <Table columns={columns} rows={q.data} rowKey={(r) => r.id} loading={q.isLoading} />
      )}
    </div>
  );
}
