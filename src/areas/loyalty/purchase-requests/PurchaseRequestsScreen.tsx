'use client';

import { useState } from 'react';
import { Check, ShoppingBag, X } from 'lucide-react';
import { confirmCertificatePurchase, confirmMembershipPurchase, listPurchaseRequests, rejectCertificatePurchase, rejectMembershipPurchase, type PurchaseRequest } from '@/api/client';
import { useApiMutation, useApiQuery } from '@/api/request';
import { BadgeSkeleton } from '@/areas/loyalty/components/Skeletons';
import { useCurrent } from '@/demo/hooks';
import type { PurchaseStatus } from '@/domain/client';
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

type StatusFilter = 'pendingConfirmation' | 'all';

const STATUS_TONE: Record<PurchaseStatus, BadgeTone> = { pendingConfirmation: 'warning', confirmed: 'success', rejected: 'neutral' };

/**
 * В-17: заявки на покупку абонемента/сертификата в приложении клиента — «Купить» создаёт заявку
 * 'pendingConfirmation' (@/api/client), здесь бизнес подтверждает оплату по реквизитам или отклоняет,
 * как заказы витрины онлайн-продаж (F-06-152) и ручная предоплата записи (F-00-097). Счётчик у пункта
 * меню — countPendingPurchaseRequests в nav.ts (@/areas/loyalty/nav.ts).
 */
export function PurchaseRequestsScreen() {
  const t = useT('loyalty');
  const format = useFormat();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const { ready, businessId } = useCurrent();
  const [status, setStatus] = useState<StatusFilter>('pendingConfirmation');

  const q = useApiQuery(['loyalty', 'appPurchaseRequests', businessId, status], () => listPurchaseRequests(businessId!, status), {
    enabled: ready && Boolean(businessId),
  });

  const confirmMutation = useApiMutation(async (row: PurchaseRequest): Promise<void> => {
    if (row.kind === 'membership') await confirmMembershipPurchase(businessId!, row.id);
    else await confirmCertificatePurchase(businessId!, row.id);
  });
  const rejectMutation = useApiMutation(async (row: PurchaseRequest): Promise<void> => {
    if (row.kind === 'membership') await rejectMembershipPurchase(businessId!, row.id);
    else await rejectCertificatePurchase(businessId!, row.id);
  });

  const onConfirm = async (row: PurchaseRequest) => {
    try {
      await confirmMutation.mutate(row);
      toast.success(t('appPurchases.confirmed'));
      q.refetch();
    } catch {
      toast.error(t('appPurchases.actionFailed'));
    }
  };
  const onReject = async (row: PurchaseRequest) => {
    const ok = await confirmDialog({ title: t('appPurchases.rejectConfirmTitle'), description: t('appPurchases.rejectConfirmText'), tone: 'danger' });
    if (!ok) return;
    try {
      await rejectMutation.mutate(row);
      toast.success(t('appPurchases.rejected'));
      q.refetch();
    } catch {
      toast.error(t('appPurchases.actionFailed'));
    }
  };

  const columns: TableColumn<PurchaseRequest>[] = [
    { id: 'purchasedAt', header: t('appPurchases.columns.date'), cell: (r) => <span className="whitespace-nowrap">{format.dateTime(r.purchasedAt)}</span>, mobile: 'meta', width: '13rem', skeletonWidth: '14ch' },
    { id: 'kind', header: '', cell: (r) => t(('appPurchases.kind.' + r.kind) as 'appPurchases.kind.membership'), mobile: 'meta', width: '8rem', skeletonWidth: '10ch' },
    { id: 'itemName', header: t('appPurchases.columns.item'), cell: (r) => <span className="line-clamp-1">{r.itemName}</span>, mobile: 'title', width: '16rem', skeletonWidth: '22ch' },
    { id: 'client', header: t('appPurchases.columns.client'), cell: (r) => <span className="line-clamp-1">{r.clientPhone ? `${r.clientName} · ${r.clientPhone}` : r.clientName}</span>, mobile: 'meta', width: '16rem', skeletonWidth: '22ch' },
    { id: 'price', header: t('appPurchases.columns.price'), cell: (r) => format.money(r.price), align: 'right', mobile: 'meta', width: '8rem', skeletonWidth: '8ch', className: 'whitespace-nowrap' },
    {
      id: 'status',
      header: t('appPurchases.columns.status'),
      cell: (r) => <Badge tone={STATUS_TONE[r.status]} className="max-w-full shrink rounded-lg py-1 leading-tight whitespace-normal">{t(('appPurchases.status.' + r.status) as 'appPurchases.status.pendingConfirmation')}</Badge>,
      mobile: 'meta',
      width: '13rem',
      skeleton: <BadgeSkeleton width="16ch" />,
    },
    {
      id: 'payment',
      header: t('appPurchases.columns.payment'),
      cell: (r) =>
        r.status === 'pendingConfirmation' ? (
          <Badge tone={r.paymentSentAt ? 'success' : 'neutral'} variant="soft" className="max-w-full shrink rounded-lg py-1 leading-tight whitespace-normal">
            {r.paymentSentAt ? t('appPurchases.paymentSent') : t('appPurchases.paymentNotSent')}
          </Badge>
        ) : null,
      mobile: 'meta',
      width: '14rem',
      skeleton: <BadgeSkeleton width="12ch" />,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      width: '18rem',
      // Скелетон — те же две кнопки (выключены): строка и карточка той же высоты и ширины
      skeleton: (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" leftIcon={<Check aria-hidden />} disabled>
            {t('appPurchases.confirm')}
          </Button>
          <Button size="sm" variant="outline" leftIcon={<X aria-hidden />} disabled>
            {t('appPurchases.reject')}
          </Button>
        </div>
      ),
      cell: (r) =>
        r.status === 'pendingConfirmation' ? (
          <div className="flex justify-end gap-1.5">
            <Button size="sm" leftIcon={<Check aria-hidden />} loading={confirmMutation.isPending} onClick={() => void onConfirm(r)}>
              {t('appPurchases.confirm')}
            </Button>
            <Button size="sm" variant="outline" leftIcon={<X aria-hidden />} loading={rejectMutation.isPending} onClick={() => void onReject(r)}>
              {t('appPurchases.reject')}
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('appPurchases.title')} description={t('appPurchases.description')} />
      <FilterBar
        filters={[
          {
            id: 'status',
            label: t('appPurchases.filterStatus'),
            node: (
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as StatusFilter)}
                options={[
                  { value: 'pendingConfirmation', label: t('appPurchases.status.pendingConfirmation') },
                  { value: 'all', label: t('appPurchases.allStatuses') },
                ]}
              />
            ),
          },
        ]}
      />
      {/* Загрузка — таблица со строками-скелетонами (в демо обычно одна заявка); пусто — то же пустое состояние */}
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <Table
          columns={columns}
          rows={q.data ?? []}
          rowKey={(r) => `${r.kind}-${r.id}`}
          loading={q.isLoading}
          loadingRows={1}
          empty={<EmptyState icon={<ShoppingBag aria-hidden />} title={t('appPurchases.emptyTitle')} description={t('appPurchases.emptyText')} />}
        />
      )}
    </div>
  );
}
