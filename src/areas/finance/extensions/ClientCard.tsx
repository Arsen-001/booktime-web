'use client';

/**
 * Вклад раздела «finance» в карточку клиента (хост «clientCard», F-07-055/057/064/070/075) — блок «Деньги»:
 * «Продано / Оплачено / Баланс» (F-07-055), визиты с долгом (F-07-057), личный счёт клиента — отмена
 * пополнения (F-07-064) и частичный возврат (F-07-070), ручной штраф (F-07-075). Права — F-07-168 (демо-набор,
 * см. src/domain/finance.ts → FinanceRights). Смотреть без хозяина: /dev/ext/clientCard/finance
 */
import { useState } from 'react';
import { AlertTriangle, History } from 'lucide-react';
import { getClientRow } from '@/api/clients/card';
import { PolicyAccountSection } from '@/areas/finance/policy/PolicyAccountSection';
import { ClientAccountsSection } from '@/areas/loyalty/components/ClientAccountsSection';
import { chargeClientPenalty, getClientMoneySummary, getFinanceRights, listAccounts, listClientDebtVisits } from '@/api/finance';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { DebtVisitFilter } from '@/domain/finance';
import { useCan, useCurrent } from '@/demo/hooks';
import type { ClientCardExtProps } from '@/extensions/types';
import { useFormat } from '@/i18n/useFormat';
import { isConnected } from '@/config/hidden';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

export default function FinanceClientCard({ clientId, businessId }: ClientCardExtProps) {
  const t = useT('finance');
  const format = useFormat();
  const toast = useToast();
  const { ready, staffId } = useCurrent();
  const canEditBlanket = useCan('finance.edit');

  const [debtFilter, setDebtFilter] = useState<DebtVisitFilter>('all');
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [penaltyAmount, setPenaltyAmount] = useState<number | undefined>(undefined);
  const [penaltyComment, setPenaltyComment] = useState('');
  const [penaltyAccountId, setPenaltyAccountId] = useState<string | undefined>(undefined);

  const enabled = ready && Boolean(businessId) && Boolean(clientId);
  const rightsQ = useApiQuery(['finance', 'rights', businessId, staffId], () => getFinanceRights(businessId, staffId!), { enabled: enabled && Boolean(staffId) });
  const summaryQ = useApiQuery(['finance', 'clientMoney', businessId, clientId], () => getClientMoneySummary(businessId, clientId), { enabled });
  const debtQ = useApiQuery(['finance', 'clientDebt', businessId, clientId, debtFilter], () => listClientDebtVisits(businessId, clientId, debtFilter), { enabled });
  const accountsQ = useApiQuery(['finance', 'accounts', businessId], () => listAccounts(businessId), { enabled });
  const clientRowQ = useApiQuery(['finance', 'clientRow', businessId, clientId], () => getClientRow(businessId, clientId), { enabled });

  const rights = rightsQ.data;
  const canEdit = canEditBlanket && (rights ? rights.canEdit : true);

  const penaltyM = useApiMutation((args: { amount: number; comment: string; accountId: string }) =>
    chargeClientPenalty(businessId, accountsQ.data?.find((a) => a.id === args.accountId)?.locationId ?? '', args.accountId, clientId, clientRowQ.data?.name, args.amount, args.comment),
  );

  const refetchAll = () => {
    summaryQ.refetch();
    debtQ.refetch();
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




  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: debtPage, pager: debtPager } = usePagedList(debtQ.data ?? [], { resetKey: debtFilter });

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

      {/* Ответ 25 (владелец 17.11.2026): один личный счёт клиента — в лояльности. «Пополнить» здесь пополняет его же,
          окно оплаты визита видит его; старое «Баланс и оплаты» перенесено миграцией 20261117150000_client_account_one */}
      <ClientAccountsSection businessId={businessId} clientId={clientId} />

      {/* b05 — F-07-112: счёт «Payment Policy» (Balance/Available/история), только при активной политике */}
      {isConnected('cardPayments') && <PolicyAccountSection businessId={businessId} clientId={clientId} />}

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

    </div>
  );
}
