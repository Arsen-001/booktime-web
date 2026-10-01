'use client';

/**
 * /biz/finance/operations/[operationId] — страница операции (F-07-014): просмотр, правка, история изменений;
 * «Отменить» (F-07-015, удаления нет); комиссия/перевод — связка (F-07-034) отменяется вместе с исходной.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Ban, ExternalLink, Pencil, SearchX, Undo2 } from 'lucide-react';
import { cancelOperation, getOperation, getRefundableSaleKind, listAccounts, listCounterparties, listItems, refundSaleOperation, updateOperation, type SaleRefundMode } from '@/api/finance';
import { useCoreList } from '@/api/core';
import { ApiError, useApiMutation, useApiQuery } from '@/api/request';
import type { Id } from '@/domain/core';
import { useCan, useCurrent } from '@/demo/hooks';
import { formatSignedMoney } from '@/areas/finance/money';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { FormField } from '@/ui/FormField';
import { KeyValueList } from '@/ui/KeyValueList';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { RadioGroup } from '@/ui/Radio';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { Textarea } from '@/ui/Textarea';
import { Timeline } from '@/ui/Timeline';
import { useConfirm, useToast } from '@/ui/Toast';

export interface OperationDetailScreenProps {
  operationId: Id;
}

export function OperationDetailScreen({ operationId }: OperationDetailScreenProps) {
  const t = useT('finance');
  // Человеческая подпись правленного поля в истории (F-07-014) — вместо сырого имени ключа
  const historyFieldLabel: Record<string, string> = {
    amount: t('operationForm.amount'),
    comment: t('operationForm.comment'),
    date: t('operationForm.date'),
    method: t('operationForm.method'),
    accountId: t('operations.columns.account'),
    itemId: t('operationForm.item'),
    partyId: t('operationForm.party'),
    partyName: t('operationForm.party'),
    partyType: t('operationForm.party'),
  };
  const tc = useT('common');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, businessId } = useCurrent();
  const canEdit = useCan('finance.edit');

  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState<number | undefined>(undefined);
  const [comment, setComment] = useState('');
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number | undefined>(undefined);
  const [refundMode, setRefundMode] = useState<SaleRefundMode>('expense');
  const [refundComment, setRefundComment] = useState('');

  const opQ = useApiQuery(['finance', 'operations', businessId, 'one', operationId], () => getOperation(businessId!, operationId), { enabled: ready && Boolean(businessId) });
  const itemsQ = useApiQuery(['finance', 'items', businessId], () => listItems(businessId!), { enabled: ready && Boolean(businessId) });
  const accountsQ = useApiQuery(['finance', 'accounts', businessId], () => listAccounts(businessId!), { enabled: ready && Boolean(businessId) });
  const cpQ = useApiQuery(['finance', 'counterparties', businessId], () => listCounterparties(businessId!), { enabled: ready && Boolean(businessId) });
  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: ready && Boolean(businessId) });

  const updateMutation = useApiMutation((input: { amount: number; comment?: string }) => updateOperation(businessId!, operationId, input));
  const cancelMutation = useApiMutation(() => cancelOperation(businessId!, operationId));
  const refundMutation = useApiMutation((input: { amount: number; mode: SaleRefundMode; comment?: string }) => refundSaleOperation(businessId!, operationId, input));

  if (opQ.isError) {
    if (opQ.error instanceof ApiError && opQ.error.code === 'not_found') {
      return (
        <EmptyState
          icon={<SearchX aria-hidden className="size-8" />}
          title={t('operationDetail.notFoundTitle')}
          description={t('operationDetail.notFoundText')}
          action={<LinkButton href="/biz/finance">{t('operationDetail.backToList')}</LinkButton>}
        />
      );
    }
    return <ErrorState onRetry={opQ.refetch} />;
  }
  if (opQ.isLoading || !opQ.data) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 p-4">
        <Skeleton lines={8} />
      </div>
    );
  }

  const op = opQ.data;
  const isTransfer = op.kind === 'transfer_in' || op.kind === 'transfer_out';
  // Перевод между кассами — не статья расходов (fin-review Ф16)
  const item = isTransfer ? { name: t('operations.transferItem') } : itemsQ.data?.find((i) => i.id === op.itemId);
  const account = accountsQ.data?.find((a) => a.id === op.accountId);
  const counterparty = op.partyType === 'counterparty' ? cpQ.data?.find((c) => c.id === op.partyId) : undefined;

  const startEdit = () => {
    setAmount(op.amount);
    setComment(op.comment ?? '');
    setEditing(true);
  };

  const save = async () => {
    if (!amount || amount <= 0) return;
    try {
      await updateMutation.mutate({ amount, comment: comment.trim() || undefined });
      toast.success(t('operationDetail.saved'));
      setEditing(false);
    } catch {
      toast.error(t('operationDetail.saveFailed'));
    }
  };

  const cancel = async () => {
    const ok = await confirm({ title: t('operationDetail.cancelTitle'), description: t('operationDetail.cancelText'), tone: 'danger', confirmLabel: t('operationDetail.cancelConfirm') });
    if (!ok) return;
    try {
      await cancelMutation.mutate(undefined);
      toast.success(t('operationDetail.cancelled'));
    } catch {
      toast.error(t('operationDetail.cancelFailed'));
    }
  };

  const partyLabel = op.partyType === 'none' ? '—' : (op.partyName ?? counterparty?.name ?? '—');

  // F-07-068/069/071/072 — «Возврат» доступен только у непогашенной до конца продажи товара/абонемента/сертификата
  const saleKind = op.kind === 'income' ? getRefundableSaleKind(businessId!, op.itemId) : undefined;
  const refundedSoFar = op.refundedAmount ?? 0;
  const refundRemaining = Math.round(op.amount - refundedSoFar);
  // F-07-014: оплату визита (и её комиссию/возврат) и пополнение счёта клиента правят и отменяют там, где их провели, —
  // иначе визит остаётся «Оплачено», а денег в кассе уже нет (или счёт клиента расходится с кассой)
  const linkedElsewhere = op.source === 'booking' || op.source === 'account';
  const canRefund = Boolean(saleKind) && !op.cancelled && refundRemaining > 0 && canEdit;
  // Разные F-id по контексту продажи: абонемент / сертификат / товар из визита / товар вне визита.

  const openRefund = () => {
    setRefundAmount(refundRemaining);
    setRefundMode('expense');
    setRefundComment('');
    setRefundOpen(true);
  };

  const doRefund = async () => {
    if (!refundAmount || refundAmount <= 0) return;
    try {
      await refundMutation.mutate({ amount: refundAmount, mode: refundMode, comment: refundComment.trim() || undefined });
      toast.success(t('operationDetail.refundDone'));
      setRefundOpen(false);
    } catch {
      toast.error(t('operationDetail.refundFailed'));
    }
  };

  return (
    <div data-f="F-07-014 F-07-015 F-07-034" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader
        back={{ href: '/biz/finance' }}
        title={item?.name ?? t('operationDetail.title')}
        description={`${format.date(op.date, 'short')}, ${format.time(op.date)}`}
        meta={
          op.cancelled ? (
            <Badge tone="neutral">{t('operations.cancelledShort')}</Badge>
          ) : (
            <Badge tone={op.kind === 'income' || op.kind === 'transfer_in' ? 'success' : 'danger'}>{formatSignedMoney(op.amount, op.kind)}</Badge>
          )
        }
        actions={
          canEdit &&
          !op.cancelled &&
          !linkedElsewhere && (
            <div className="flex flex-wrap gap-2">
              {!editing && (
                <Button variant="secondary" leftIcon={<Pencil aria-hidden />} onClick={startEdit}>
                  {tc('actions.edit')}
                </Button>
              )}
              <Button variant="secondary" leftIcon={<Ban aria-hidden />} onClick={cancel} loading={cancelMutation.isPending} className="text-danger hover:bg-danger-soft">
                {t('operationDetail.cancel')}
              </Button>
              {canRefund && (
                <Button data-f="F-07-068 F-07-069 F-07-071 F-07-072" variant="secondary" leftIcon={<Undo2 aria-hidden />} onClick={openRefund}>
                  {t('operationDetail.refund')}
                </Button>
              )}
            </div>
          )
        }
      />

      {linkedElsewhere && !op.cancelled && canEdit && <p className="-mt-3 text-sm text-muted">{op.source === 'booking' ? t('operationDetail.linkedBooking') : t('operationDetail.linkedAccount')}</p>}

      <SectionCard title={t('operationDetail.details')}>
        {editing ? (
          <div className="flex flex-col gap-4">
            <FormField label={t('operationForm.amount')}>
              <MoneyInput value={amount} onValueChange={setAmount} />
            </FormField>
            <FormField label={t('operationForm.comment')}>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)}>
                {tc('actions.cancel')}
              </Button>
              <Button onClick={save} loading={updateMutation.isPending}>
                {tc('actions.save')}
              </Button>
            </div>
          </div>
        ) : (
          <KeyValueList
            columns={2}
            items={[
              { label: t('operations.columns.account'), value: account?.name ?? '—' },
              { label: t('operations.columns.method'), value: t(`operations.method.${op.method}`) },
              { label: t('operations.columns.party'), value: partyLabel },
              { label: t('operations.columns.item'), value: item?.name ?? '—' },
              { label: t('operationDetail.source'), value: t(`operations.source.${op.source}`) },
              op.comment ? { label: t('operationForm.comment'), value: op.comment } : undefined,
              op.refId
                ? {
                    label: t('operationDetail.booking'),
                    value: (
                      <Link href={`/biz/journal?booking=${op.refId}`} className="inline-flex items-center gap-1 text-primary-text underline decoration-border-strong underline-offset-2">
                        {t('operationDetail.openBooking')} <ExternalLink aria-hidden className="size-3.5" />
                      </Link>
                    ),
                  }
                : undefined,
              op.transferGroupId ? { label: t('operationDetail.transferPair'), value: t('operationDetail.transferPairHint') } : undefined,
              op.feeOfOperationId
                ? {
                    label: t('operationDetail.feeOf'),
                    value: (
                      <Link href={`/biz/finance/operations/${op.feeOfOperationId}`} className="inline-flex items-center gap-1 text-primary-text underline decoration-border-strong underline-offset-2">
                        {t('operationDetail.openOperation')}
                      </Link>
                    ),
                  }
                : undefined,
            ].filter((x): x is NonNullable<typeof x> => Boolean(x))}
          />
        )}
      </SectionCard>

      <SectionCard title={t('operationDetail.history')}>
        <Timeline
          items={op.history.map((h, i) => {
            const author = h.by === 'system' ? t('operations.systemAuthor') : (staffQ.data?.find((s) => s.id === h.by)?.name ?? h.by);
            const byLine = t('operationDetail.historyBy', { name: author });
            const fieldLabel = h.field ? (historyFieldLabel[h.field] ?? h.field) : undefined;
            const change = h.action === 'edited' && h.field ? t('operationDetail.historyChange', { field: fieldLabel ?? h.field, from: h.from ?? '—', to: h.to ?? '—' }) : undefined;
            return {
              id: String(i),
              title: t(`operationDetail.historyAction.${h.action}`),
              time: `${format.date(h.at, 'short')}, ${format.time(h.at)}`,
              description: change ? `${byLine} · ${change}` : byLine,
              tone: h.action === 'cancelled' ? ('danger' as const) : h.action === 'edited' ? ('warning' as const) : ('success' as const),
            };
          })}
        />
      </SectionCard>

      {/* F-07-068/069/071/072 — возврат по продаже товара/абонемента/сертификата */}
      <Modal open={refundOpen} onOpenChange={setRefundOpen} title={t('operationDetail.refundTitle')} description={refundedSoFar > 0 ? t('operationDetail.refundAlreadyDone', { amount: format.money(refundedSoFar) }) : undefined}>
        <div data-f="F-07-068 F-07-069 F-07-071 F-07-072" className="flex flex-col gap-3">
          <FormField label={t('operationDetail.refundAmount')}>
            <MoneyInput value={refundAmount} onValueChange={setRefundAmount} max={refundRemaining} />
          </FormField>
          <FormField label={t('operationDetail.refundModeLabel')}>
            <RadioGroup
              value={refundMode}
              onValueChange={(v) => setRefundMode(v as SaleRefundMode)}
              options={[
                { value: 'expense', label: t('operationDetail.refundModeExpense'), description: t('operationDetail.refundModeExpenseHint') },
                { value: 'cancel', label: t('operationDetail.refundModeCancel'), description: t('operationDetail.refundModeCancelHint'), disabled: refundAmount !== undefined && refundAmount < refundRemaining },
              ]}
            />
          </FormField>
          <FormField label={t('operationDetail.refundComment')}>
            <Textarea value={refundComment} onChange={(e) => setRefundComment(e.target.value)} rows={2} />
          </FormField>
          <p className="text-xs text-muted">{t('operationDetail.refundStockNote')}</p>
          <Button loading={refundMutation.isPending} disabled={!refundAmount || refundAmount <= 0} onClick={doRefund}>
            {t('operationDetail.refundConfirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
