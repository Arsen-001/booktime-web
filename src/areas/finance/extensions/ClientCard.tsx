'use client';

/**
 * Вклад раздела «finance» в карточку клиента (хост «clientCard», F-07-055/057/064/070/075) — блок «Деньги»:
 * «Продано / Оплачено / Баланс» (F-07-055), визиты с долгом (F-07-057), личный счёт клиента — отмена
 * пополнения (F-07-064) и частичный возврат (F-07-070), ручной штраф (F-07-075). Права — F-07-168 (демо-набор,
 * см. src/domain/finance.ts → FinanceRights). Смотреть без хозяина: /dev/ext/clientCard/finance
 */
import { useState } from 'react';
import { AlertTriangle, Ban, Coins, History, RotateCcw, Wallet } from 'lucide-react';
import { getClientRow } from '@/api/clients/card';
import { PolicyAccountSection } from '@/areas/finance/policy/PolicyAccountSection';
import { cancelClientAccountTopUp, chargeClientPenalty, getClientMoneySummary, getFinanceRights, listAccounts, listClientAccountTopUps, listClientDebtVisits, refundClientAccountPartial, topUpClientAccount } from '@/api/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { DebtVisitFilter } from '@/domain/finance';
import { useCan, useCurrent } from '@/demo/hooks';
import type { ClientCardExtProps } from '@/extensions/types';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { Textarea } from '@/ui/Textarea';
import { Tooltip } from '@/ui/Tooltip';
import { useConfirm, useToast } from '@/ui/Toast';

export default function FinanceClientCard({ clientId, businessId }: ClientCardExtProps) {
  const t = useT('finance');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, staffId } = useCurrent();
  const canEditBlanket = useCan('finance.edit');

  const [debtFilter, setDebtFilter] = useState<DebtVisitFilter>('all');
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState<number | undefined>(undefined);
  const [penaltyComment, setPenaltyComment] = useState('');
  const [penaltyAccountId, setPenaltyAccountId] = useState<string | undefined>(undefined);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState<number | undefined>(undefined);
  const [refundComment, setRefundComment] = useState('');
  const [refundAccountId, setRefundAccountId] = useState<string | undefined>(undefined);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number | undefined>(undefined);
  const [topUpMethod, setTopUpMethod] = useState<'cash' | 'card'>('cash');
  const [topUpAccountId, setTopUpAccountId] = useState<string | undefined>(undefined);

  const enabled = ready && Boolean(businessId) && Boolean(clientId);
  const rightsQ = useApiQuery(['finance', 'rights', businessId, staffId], () => getFinanceRights(businessId, staffId!), { enabled: enabled && Boolean(staffId) });
  const summaryQ = useApiQuery(['finance', 'clientMoney', businessId, clientId], () => getClientMoneySummary(businessId, clientId), { enabled });
  const debtQ = useApiQuery(['finance', 'clientDebt', businessId, clientId, debtFilter], () => listClientDebtVisits(businessId, clientId, debtFilter), { enabled });
  const topUpsQ = useApiQuery(['finance', 'topUps', businessId, clientId], () => listClientAccountTopUps(businessId, clientId), { enabled });
  const accountsQ = useApiQuery(['finance', 'accounts', businessId], () => listAccounts(businessId), { enabled });
  const clientRowQ = useApiQuery(['finance', 'clientRow', businessId, clientId], () => getClientRow(businessId, clientId), { enabled });

  const rights = rightsQ.data;
  const canEdit = canEditBlanket && (rights ? rights.canEdit : true);
  const canViewAccountHistory = rights ? rights.canViewClientAccountHistory : true;

  const penaltyM = useApiMutation((args: { amount: number; comment: string; accountId: string }) =>
    chargeClientPenalty(businessId, accountsQ.data?.find((a) => a.id === args.accountId)?.locationId ?? '', args.accountId, clientId, clientRowQ.data?.name, args.amount, args.comment),
  );
  const cancelTopUpM = useApiMutation((topUpId: string) => cancelClientAccountTopUp(businessId, topUpId));
  const refundM = useApiMutation((args: { amount: number; accountId: string; comment: string }) => refundClientAccountPartial(businessId, clientId, args.accountId, args.amount, args.comment));
  const topUpM = useApiMutation((args: { amount: number; accountId: string; method: 'cash' | 'card' }) =>
    topUpClientAccount(businessId, clientId, clientRowQ.data?.name, args.accountId, args.amount, args.method),
  );

  const refetchAll = () => {
    summaryQ.refetch();
    debtQ.refetch();
    topUpsQ.refetch();
  };

  const handlePenalty = async () => {
    if (!penaltyAmount || penaltyAmount <= 0 || !penaltyAccountId) return;
    try {
      await penaltyM.mutate({ amount: penaltyAmount, comment: penaltyComment.trim(), accountId: penaltyAccountId });
      toast.success(t('clientMoney.penaltyCharged'));
      setPenaltyOpen(false);
      setPenaltyAmount(undefined);
      setPenaltyComment('');
      refetchAll();
    } catch {
      toast.error(t('clientMoney.actionFailed'));
    }
  };

  const handleCancelTopUp = async (topUpId: string) => {
    const ok = await confirm({ title: t('clientMoney.cancelTopUpTitle'), description: t('clientMoney.cancelTopUpText'), tone: 'danger', confirmLabel: t('clientMoney.cancelTopUpConfirm') });
    if (!ok) return;
    try {
      await cancelTopUpM.mutate(topUpId);
      toast.success(t('clientMoney.topUpCancelled'));
      refetchAll();
    } catch {
      toast.error(t('clientMoney.actionFailed'));
    }
  };

  const handleTopUp = async () => {
    if (!topUpAmount || topUpAmount <= 0 || !topUpAccountId) return;
    try {
      await topUpM.mutate({ amount: topUpAmount, accountId: topUpAccountId, method: topUpMethod });
      toast.success(t('clientMoney.topUpDone'));
      setTopUpOpen(false);
      setTopUpAmount(undefined);
      refetchAll();
    } catch {
      toast.error(t('clientMoney.actionFailed'));
    }
  };

  const handleRefund = async () => {
    if (!refundAmount || refundAmount <= 0 || !refundAccountId) return;
    try {
      await refundM.mutate({ amount: refundAmount, accountId: refundAccountId, comment: refundComment.trim() });
      toast.success(t('clientMoney.refunded'));
      setRefundOpen(false);
      setRefundAmount(undefined);
      setRefundComment('');
      refetchAll();
    } catch {
      toast.error(t('clientMoney.actionFailed'));
    }
  };

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: debtPage, pager: debtPager } = usePagedList(debtQ.data ?? [], { resetKey: debtFilter });
  const { pageItems: topUpsPage, pager: topUpsPager } = usePagedList((topUpsQ.data ?? []).filter((tp) => !tp.cancelled));

  if (summaryQ.isError || debtQ.isError) {
    return (
      <div className="py-6">
        <ErrorState
          onRetry={() => {
            summaryQ.refetch();
            debtQ.refetch();
          }}
        />
      </div>
    );
  }

  // Загрузка — та же вкладка (карточки итогов, списки, кнопки), серые места вместо сумм и строк
  const loading = !enabled || summaryQ.isLoading || !summaryQ.data;
  const summary = summaryQ.data ?? { sold: 0, paid: 0, balance: 0, visitCount: 0 };
  const activeTopUps = (topUpsQ.data ?? []).filter((tp) => !tp.cancelled);
  const accountBalance = activeTopUps.reduce((s, tp) => s + tp.amount, 0);
  const balanceTone = summary.balance < 0 ? 'text-danger' : summary.balance > 0 ? 'text-success' : 'text-fg';

  return (
    <div data-f="F-07-055" className="flex flex-col gap-5">
      <SectionCard title={t('clientMoney.title')} padding="sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <StatCard label={t('clientMoney.sold')} value={format.money(summary.sold)} hint={t('clientMoney.soldHint', { count: summary.visitCount })} loading={loading} />
          <StatCard label={t('clientMoney.paid')} value={format.money(summary.paid)} loading={loading} />
          <StatCard label={t('clientMoney.balance')} value={<span className={balanceTone}>{format.money(summary.balance)}</span>} loading={loading} />
        </div>
        {summary.balance < 0 && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">
            <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
            {t('clientMoney.debtHint')}
          </p>
        )}
      </SectionCard>

      <div data-f="F-07-057">
        <SectionCard title={<span className="flex items-center gap-2"><History aria-hidden className="size-4 text-muted" />{t('clientMoney.debtVisitsTitle')}</span>} padding="sm">
          <SegmentedControl
            value={debtFilter}
            onValueChange={(v) => setDebtFilter(v as DebtVisitFilter)}
            options={[
              { value: 'all', label: t('clientMoney.filterAll') },
              { value: 'unpaid', label: t('clientMoney.filterUnpaid') },
              { value: 'accountDebt', label: t('clientMoney.filterAccountDebt') },
            ]}
          />
          <div className="mt-3">
            {loading || debtQ.isLoading ? (
              <ul className="flex flex-col gap-2">
                {Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        <SkeletonText width="18ch" />
                      </p>
                      <p className="text-xs text-muted">
                        <SkeletonText width="14ch" />
                      </p>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      <SkeletonText width="8ch" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : !debtQ.data || debtQ.data.length === 0 ? (
              <EmptyState compact icon={<History aria-hidden className="size-6" />} title={t('clientMoney.debtVisitsEmpty')} />
            ) : (
              <ul className="flex flex-col gap-2">
                {debtPage.map((row) => (
                  <li key={row.bookingId} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{row.serviceLabel}</p>
                      <p className="text-xs text-muted">
                        {format.date(row.start, 'short')} · {row.method}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {row.debt && <Badge tone="danger">{t('clientMoney.debtBadge')}</Badge>}
                      {row.due > 0 && <span className="text-sm font-medium tabular-nums text-danger">{format.money(row.due)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {debtPager && <div className="mt-3">{debtPager}</div>}
          </div>
        </SectionCard>
      </div>

      <div data-f="F-07-059 F-07-060 F-07-063 F-07-064 F-07-065 F-07-070">
        <SectionCard title={<span className="flex items-center gap-2"><Wallet aria-hidden className="size-4 text-muted" />{t('clientMoney.accountTitle')}</span>} padding="sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-lg font-semibold tabular-nums">{loading || topUpsQ.isLoading ? <SkeletonText width="8ch" /> : format.money(accountBalance)}</span>
            <div className="flex items-center gap-2">
              {canEdit && (
                <Button size="sm" leftIcon={<Coins aria-hidden className="size-4" />} onClick={() => { setTopUpAccountId(undefined); setTopUpAmount(undefined); setTopUpMethod('cash'); setTopUpOpen(true); }}>
                  {t('clientMoney.topUp')}
                </Button>
              )}
              {canEdit && accountBalance > 0 && (
                <Button size="sm" variant="secondary" leftIcon={<RotateCcw aria-hidden className="size-4" />} onClick={() => setRefundOpen(true)}>
                  {t('clientMoney.refundPartial')}
                </Button>
              )}
            </div>
          </div>
          {!canViewAccountHistory ? (
            <p className="mt-3 text-xs text-muted">{t('clientMoney.historyHidden')}</p>
          ) : loading || topUpsQ.isLoading ? (
            <ul className="mt-3 flex flex-col gap-2">
              {Array.from({ length: 2 }, (_, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <span className="text-sm">
                    <SkeletonText width="9ch" />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums">
                      <SkeletonText width="9ch" />
                    </span>
                    {canEdit && <IconButton icon={<Ban aria-hidden className="size-4" />} label={t('clientMoney.cancelTopUp')} disabled />}
                  </div>
                </li>
              ))}
            </ul>
          ) : activeTopUps.length === 0 ? (
            <div className="mt-3">
              <EmptyState compact icon={<Coins aria-hidden className="size-6" />} title={t('clientMoney.noTopUps')} />
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {topUpsPage.map((tp) => (
                <li key={tp.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <span className="text-sm">{format.date(tp.createdAt, 'short')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium tabular-nums text-success">+{format.money(tp.amount)}</span>
                    {canEdit && (
                      <Tooltip content={t('clientMoney.cancelTopUp')}>
                        <IconButton icon={<Ban aria-hidden className="size-4" />} label={t('clientMoney.cancelTopUp')} onClick={() => handleCancelTopUp(tp.id)} disabled={cancelTopUpM.isPending} />
                      </Tooltip>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canViewAccountHistory && topUpsPager && <div className="mt-3">{topUpsPager}</div>}
        </SectionCard>
      </div>

      {/* b05 — F-07-112: счёт «Payment Policy» (Balance/Available/история), только при активной политике */}
      <PolicyAccountSection businessId={businessId} clientId={clientId} />

      {canEdit && (
        <Button data-f="F-07-075" variant="secondary" leftIcon={<AlertTriangle aria-hidden className="size-4" />} className="self-start text-danger hover:bg-danger-soft" onClick={() => setPenaltyOpen(true)}>
          {t('clientMoney.chargePenalty')}
        </Button>
      )}

      {/* F-07-075 — ручной штраф клиенту */}
      <Modal open={penaltyOpen} onOpenChange={setPenaltyOpen} title={t('clientMoney.chargePenalty')} description={t('clientMoney.chargePenaltyHint')}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('clientMoney.amount')}</span>
            <MoneyInput value={penaltyAmount} onValueChange={setPenaltyAmount} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('clientMoney.account')}</span>
            <Select value={penaltyAccountId} onValueChange={setPenaltyAccountId} placeholder={t('clientMoney.accountPlaceholder')} options={(accountsQ.data ?? []).map((a) => ({ value: a.id, label: a.name }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('clientMoney.comment')}</span>
            <Textarea value={penaltyComment} onChange={(e) => setPenaltyComment(e.target.value)} rows={2} />
          </label>
          <Button loading={penaltyM.isPending} disabled={!penaltyAmount || penaltyAmount <= 0 || !penaltyAccountId} onClick={handlePenalty}>
            {t('clientMoney.chargePenaltyConfirm')}
          </Button>
        </div>
      </Modal>

      {/* F-07-059/060 — открытие/пополнение счёта клиента: первое пополнение открывает счёт «по факту» */}
      <Modal open={topUpOpen} onOpenChange={setTopUpOpen} title={t('clientMoney.topUp')} description={t('clientMoney.topUpHint')}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('clientMoney.amount')}</span>
            <MoneyInput value={topUpAmount} onValueChange={setTopUpAmount} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('clientMoney.account')}</span>
            <Select value={topUpAccountId} onValueChange={setTopUpAccountId} placeholder={t('clientMoney.accountPlaceholder')} options={(accountsQ.data ?? []).map((a) => ({ value: a.id, label: a.name }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('clientMoney.method')}</span>
            <SegmentedControl
              value={topUpMethod}
              onValueChange={(v) => setTopUpMethod(v as 'cash' | 'card')}
              options={[
                { value: 'cash', label: t('clientMoney.methodCash') },
                { value: 'card', label: t('clientMoney.methodCard') },
              ]}
            />
          </label>
          <Button loading={topUpM.isPending} disabled={!topUpAmount || topUpAmount <= 0 || !topUpAccountId} onClick={handleTopUp}>
            {t('clientMoney.topUpConfirm')}
          </Button>
        </div>
      </Modal>

      {/* F-07-070 — частичный возврат со счёта клиента */}
      <Modal open={refundOpen} onOpenChange={setRefundOpen} title={t('clientMoney.refundPartial')} description={t('clientMoney.refundPartialHint')}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('clientMoney.amount')}</span>
            <MoneyInput value={refundAmount} onValueChange={setRefundAmount} max={accountBalance} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('clientMoney.account')}</span>
            <Select value={refundAccountId} onValueChange={setRefundAccountId} placeholder={t('clientMoney.accountPlaceholder')} options={(accountsQ.data ?? []).map((a) => ({ value: a.id, label: a.name }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('clientMoney.comment')}</span>
            <Textarea value={refundComment} onChange={(e) => setRefundComment(e.target.value)} rows={2} />
          </label>
          <Button loading={refundM.isPending} disabled={!refundAmount || refundAmount <= 0 || !refundAccountId} onClick={handleRefund}>
            {t('clientMoney.refundPartialConfirm')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
