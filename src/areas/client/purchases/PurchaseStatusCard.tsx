'use client';

import { Copy, Wallet, XCircle } from 'lucide-react';
import { markCertificatePaymentSent, markMembershipPaymentSent } from '@/api/client';
import { getOnlineSalePayment } from '@/api/loyalty';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { Id, ISODateTime, Money } from '@/domain/core';
import type { PurchaseStatus } from '@/domain/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { copyText } from '@/lib/clipboard';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { IconButton } from '@/ui/IconButton';
import { useToast } from '@/ui/Toast';

/**
 * В-17: заявка на покупку абонемента/сертификата в приложении, пока бизнес не подтвердил оплату —
 * та же схема, что ручная предоплата записи (F-00-097): реквизиты бизнеса, «Я оплатил», дальше решает
 * бизнес в разделе loyalty. `null` (готовая покупка) — компонент ничего не рендерит.
 */
export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  const t = useT('client');
  if (status === 'pendingConfirmation') return <Badge tone="warning" variant="soft">{t('purchaseRequest.pendingBadge')}</Badge>;
  if (status === 'rejected') return <Badge tone="danger" variant="soft">{t('purchaseRequest.rejectedBadge')}</Badge>;
  return null;
}

export function PurchaseStatusCard({
  kind,
  id,
  appUserId,
  businessId,
  price,
  status,
  paymentSentAt,
  onChanged,
}: {
  kind: 'membership' | 'certificate';
  id: Id;
  appUserId: Id | undefined;
  businessId: Id;
  price: Money;
  status: PurchaseStatus;
  paymentSentAt?: ISODateTime;
  onChanged: () => void;
}) {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();

  const paymentQ = useApiQuery(['loyalty', 'onlineSalePayment', businessId], () => getOnlineSalePayment(businessId), {
    enabled: status === 'pendingConfirmation',
  });
  const requisites = paymentQ.data?.otherMethodEnabled ? paymentQ.data.otherMethodDetails : undefined;

  const markPaid = useApiMutation(async (): Promise<void> => {
    if (kind === 'membership') await markMembershipPaymentSent(id, appUserId);
    else await markCertificatePaymentSent(id, appUserId);
  });

  const copy = async () => {
    if (!requisites) return;
    if (await copyText(requisites)) toast.success(t('purchaseRequest.requisitesCopied'));
    else toast.info(t('purchaseRequest.copyManually'));
  };

  const handlePaid = async () => {
    try {
      await markPaid.mutate(undefined);
      onChanged();
    } catch {
      toast.error(t('purchaseRequest.actionFailed'));
    }
  };

  if (status === 'rejected') {
    return (
      <Card padding="lg" className="flex items-start gap-3 border-danger/30 bg-danger-soft/30">
        <XCircle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
        <p className="text-sm text-fg">{t('purchaseRequest.rejectedText')}</p>
      </Card>
    );
  }

  if (status !== 'pendingConfirmation') return null;

  if (paymentSentAt) {
    return (
      <Card padding="lg" className="flex items-start gap-3 border-warning/30 bg-warning-soft/40">
        <Wallet aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
        <p className="text-sm text-fg">{t('purchaseRequest.waitingConfirmation')}</p>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4 border-warning/30 bg-warning-soft/40">
      <div className="flex items-start gap-3">
        <Wallet aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="font-semibold text-fg">{t('purchaseRequest.pendingTitle')}</p>
          <p className="text-sm text-muted">{t('purchaseRequest.amount', { amount: fmt.money(price) })}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface py-1 pr-1 pl-3">
        <p className="min-w-0 flex-1 text-sm text-fg">
          {requisites ? t('purchaseRequest.requisites', { requisites }) : t('purchaseRequest.requisitesUnavailable')}
        </p>
        {requisites && <IconButton icon={<Copy aria-hidden />} label={t('purchaseRequest.copyRequisites')} variant="ghost" onClick={() => void copy()} />}
      </div>
      <Button onClick={() => void handlePaid()} loading={markPaid.isPending} fullWidth>
        {t('purchaseRequest.iPaid')}
      </Button>
    </Card>
  );
}
