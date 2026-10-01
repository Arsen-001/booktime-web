'use client';

/**
 * /biz/finance/online/orders — «Онлайн-продажи · Другим способом» (F-07-132): заказы абонементов и
 * сертификатов, где клиент платит переводом по реквизитам, а не через платёжную систему — администратор
 * подтверждает или отклоняет вручную. У оплаченного заказа — возврат (F-07-073): убирает операции,
 * деньги клиенту бизнес возвращает вне системы.
 */
import { useState } from 'react';
import { Banknote, Gift, ShoppingBag, Undo2 } from 'lucide-react';
import { confirmManualOnlineOrder, listAccounts, listManualOnlineOrders, rejectManualOnlineOrder, refundManualOnlineOrder } from '@/api/finance';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import type { ManualOnlineOrder } from '@/domain/finance';
import { useCan, useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { Modal } from '@/ui/Modal';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Select } from '@/ui/Select';
import { Skeleton } from '@/ui/Skeleton';
import { Tabs } from '@/ui/Tabs';
import { useConfirm, useToast } from '@/ui/Toast';
import { ExitHold } from '@/ui/ExitHold';

const STATUS_TONE: Record<ManualOnlineOrder['status'], BadgeTone> = {
  pendingPayment: 'warning',
  paid: 'success',
  rejected: 'neutral',
  refunded: 'neutral',
};

export function ManualOnlineOrdersScreen() {
  const t = useT('finance');
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');
  const [tab, setTab] = useState<'pendingPayment' | 'paid' | 'other'>('pendingPayment');
  const [confirming, setConfirming] = useState<ManualOnlineOrder | null>(null);

  const ordersQ = useApiQuery(['finance', 'manualOnlineOrders', businessId], () => listManualOnlineOrders(businessId!), { enabled: ready && Boolean(businessId) });
  const rejectM = useApiMutation((id: string) => rejectManualOnlineOrder(businessId!, id));
  const refundM = useApiMutation((id: string) => refundManualOnlineOrder(businessId!, id));

  const orders = ordersQ.data ?? [];
  const shown = orders.filter((o) => (tab === 'other' ? o.status === 'rejected' || o.status === 'refunded' : o.status === tab));
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: shownPage, pager } = usePagedList(shown, { resetKey: tab });

  if (ordersQ.isError) return <ErrorState onRetry={ordersQ.refetch} />;

  const reject = async (order: ManualOnlineOrder) => {
    const ok = await confirm({ title: t('manualOrders.rejectTitle'), description: t('manualOrders.rejectText', { name: order.typeName }), tone: 'danger', confirmLabel: t('manualOrders.rejectConfirm') });
    if (!ok) return;
    try {
      await rejectM.mutate(order.id);
      ordersQ.refetch();
      toast.success(t('manualOrders.rejected'));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('manualOrders.actionFailed'));
    }
  };

  const refund = async (order: ManualOnlineOrder) => {
    const ok = await confirm({ title: t('manualOrders.refundTitle'), description: t('manualOrders.refundText', { name: order.typeName }), tone: 'danger', confirmLabel: t('manualOrders.refundConfirm') });
    if (!ok) return;
    try {
      await refundM.mutate(order.id);
      ordersQ.refetch();
      toast.success(t('manualOrders.refunded'));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('manualOrders.actionFailed'));
    }
  };

  return (
    <div data-f="F-07-132" className="flex w-full flex-col gap-6">
      <PageHeader back={{ href: '/biz/finance/online' }} title={t('manualOrders.title')} description={t('manualOrders.subtitle')} />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        items={[
          { value: 'pendingPayment', label: t('manualOrders.tabPending') },
          { value: 'paid', label: t('manualOrders.tabPaid') },
          { value: 'other', label: t('manualOrders.tabOther') },
        ]}
      />

      {ordersQ.isLoading ? (
        <Skeleton lines={5} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<ShoppingBag aria-hidden />} title={t('manualOrders.emptyTitle')} description={t('manualOrders.emptyDescription')} />
      ) : (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2.5">
            {shownPage.map((order) => (
              <li key={order.id} className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
                      {order.kind === 'certificate' ? <Gift aria-hidden className="size-4.5" /> : <Banknote aria-hidden className="size-4.5" />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-fg">{order.typeName}</p>
                      <p className="text-xs text-muted">{order.clientName}{order.clientPhone ? ` · ${order.clientPhone}` : ''}</p>
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[order.status]}>{t(`manualOrders.status.${order.status}`)}</Badge>
                </div>
                <MoneyRow order={order} />
                {canEdit && order.status === 'pendingPayment' && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => setConfirming(order)}>
                      {t('manualOrders.confirm')}
                    </Button>
                    <Button size="sm" variant="secondary" className="text-danger hover:bg-danger-soft" loading={rejectM.isPending} onClick={() => reject(order)}>
                      {t('manualOrders.reject')}
                    </Button>
                  </div>
                )}
                {canEdit && order.status === 'paid' && (
                  <Button data-f="F-07-073" size="sm" variant="secondary" leftIcon={<Undo2 aria-hidden className="size-3.5" />} className="self-start" loading={refundM.isPending} onClick={() => refund(order)}>
                    {t('manualOrders.refund')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {pager}
        </div>
      )}

      <ExitHold value={confirming}>
        {(confirming) => (
        <ConfirmOrderModal
          businessId={businessId!}
          order={confirming}
          onClose={() => setConfirming(null)}
          onDone={() => {
            setConfirming(null);
            ordersQ.refetch();
          }}
        />
        )}
      </ExitHold>
    </div>
  );
}

function MoneyRow({ order }: { order: ManualOnlineOrder }) {
  const format = useFormat();
  const t = useT('finance');
  return (
    <p className="text-sm">
      <span className="text-muted">{t('manualOrders.amount')}: </span>
      <span className="font-semibold">{format.money(order.amount)}</span>
      {order.code && (
        <span className="ml-3 text-xs text-muted">
          {t('manualOrders.code')}: {order.code}
        </span>
      )}
    </p>
  );
}

function ConfirmOrderModal({ businessId, order, onClose, onDone }: { businessId: string; order: ManualOnlineOrder; onClose: () => void; onDone: () => void }) {
  const t = useT('finance');
  const toast = useToast();
  const accountsQ = useApiQuery(['finance', 'accounts', businessId], () => listAccounts(businessId));
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const confirmMutation = useApiMutation((accId: string) => confirmManualOnlineOrder(businessId, order.id, accId));

  const submit = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      await confirmMutation.mutate(accountId);
      toast.success(t('manualOrders.confirmed'));
      onDone();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t('manualOrders.actionFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={t('manualOrders.confirmTitle')}
      description={t('manualOrders.confirmText', { name: order.typeName })}
      footer={
        <Button className="w-full" onClick={submit} loading={saving} disabled={!accountId || accountsQ.isLoading}>
          {t('manualOrders.confirm')}
        </Button>
      }
    >
      <FormField label={t('manualOrders.accountLabel')}>
        <Select value={accountId} onValueChange={setAccountId} placeholder={t('manualOrders.accountPlaceholder')} options={(accountsQ.data ?? []).map((a) => ({ value: a.id, label: a.name }))} />
      </FormField>
    </Modal>
  );
}
