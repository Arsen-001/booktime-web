'use client';

/**
 * /biz/finance/settlements — «Взаиморасчёты» с сотрудником (F-07-159): выбор сотрудника (мастер видит только
 * себя, F-07-166/167), лента начислений/выплат с балансом, «Создать расчётную ведомость» (F-07-162, ⭐
 * демо-упрощение — сумма визитов «пришёл» за период, полные схемы зарплаты не построены), «Выписать
 * премию/штраф», «Внеочередное начисление» (F-07-161), «Выдать зарплату» (F-07-160).
 */
import { useState } from 'react';
import { Banknote, Gift, Minus, Plus, Trash2, Users } from 'lucide-react';
import {
  cancelSalaryPayout,
  createSettlementEntry,
  deleteSettlementEntry,
  getFinanceRights,
  listAccountsWithBalance,
} from '@/api/finance';
import { useCoreList } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import type { DateRange } from '@/ui/Calendar';
import { useCan, useCurrent } from '@/demo/hooks';
import { today } from '@/lib/date';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { Input } from '@/ui/Input';
import { Modal } from '@/ui/Modal';
import { MoneyInput } from '@/ui/MoneyInput';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { Textarea } from '@/ui/Textarea';
import { useConfirm, useToast } from '@/ui/Toast';
import { SalaryPayoutModal } from '@/areas/finance/SalaryPayoutModal';
import { useSheetNewDays } from '@/areas/payroll/sheetNewDays';
import { listSettlementEntries, getSettlementBalance } from '@/api/finance';
import type { SettlementEntryKind } from '@/domain/finance';

const KIND_ICON: Record<SettlementEntryKind, typeof Banknote> = { sheet: Users, bonus: Gift, penalty: Minus, adjustment: Plus, payout: Banknote };

export function SettlementsScreen() {
  const t = useT('finance');
  const format = useFormat();
  const toast = useToast();
  const confirm = useConfirm();
  const { ready, businessId, staffId: myStaffId } = useCurrent();
  const canEditBlanket = useCan('finance.edit');

  const staffQ = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: ready && Boolean(businessId) });
  const rightsQ = useApiQuery(['finance', 'rights', businessId, myStaffId], () => getFinanceRights(businessId!, myStaffId!), {
    enabled: ready && Boolean(businessId) && Boolean(myStaffId),
  });
  const rights = rightsQ.data;
  const ownOnly = Boolean(rights?.payrollOwnStaffOnly);

  const [staffId, setStaffId] = useState<string | undefined>(undefined);
  const [range, setRange] = useState<DateRange>(() => ({ from: today(), to: today() }));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState<Extract<SettlementEntryKind, 'bonus' | 'penalty' | 'adjustment'> | null>(null);
  const [entryLabel, setEntryLabel] = useState('');
  const [entryAmount, setEntryAmount] = useState<number | undefined>(undefined);
  const [entryComment, setEntryComment] = useState('');
  const [payoutOpen, setPayoutOpen] = useState(false);

  const effectiveStaffId = ownOnly ? myStaffId : (staffId ?? myStaffId);
  const staff = (staffQ.data ?? []).find((s) => s.id === effectiveStaffId);
  const staffList = ownOnly ? (staffQ.data ?? []).filter((s) => s.id === myStaffId) : (staffQ.data ?? []);

  const entriesQ = useApiQuery(
    ['finance', 'settlements', businessId, effectiveStaffId],
    () => listSettlementEntries(businessId!, effectiveStaffId!),
    { enabled: ready && Boolean(businessId) && Boolean(effectiveStaffId) },
  );
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: entryPage, pager: entryPager } = usePagedList(entriesQ.data ?? [], { resetKey: effectiveStaffId });
  const balanceQ = useApiQuery(
    ['finance', 'settlementBalance', businessId, effectiveStaffId],
    () => getSettlementBalance(businessId!, effectiveStaffId!),
    { enabled: ready && Boolean(businessId) && Boolean(effectiveStaffId) },
  );
  const accountsQ = useApiQuery(['finance', 'accountsWithBalance', businessId], () => listAccountsWithBalance(businessId!), { enabled: ready && Boolean(businessId) });

  const canAccrue = canEditBlanket && (rights ? rights.canAccruePayroll : true) && !ownOnly;

  // Ответ 27 (17.11.2026): дни уже начислены — спрашиваем, начислить ли только новые
  const sheetNewDays = useSheetNewDays();
  const sheetM = useApiMutation((args: { from: string; to: string; comment: string }) =>
    sheetNewDays(businessId!, effectiveStaffId!, args.from, args.to, { comment: args.comment }),
  );
  const entryM = useApiMutation(
    (args: { kind: Extract<SettlementEntryKind, 'bonus' | 'penalty' | 'adjustment'>; label: string; amount: number; comment: string }) =>
      createSettlementEntry(businessId!, effectiveStaffId!, args.kind, args.label, args.amount, args.comment),
  );
  const deleteM = useApiMutation((entryId: string) => deleteSettlementEntry(businessId!, entryId));
  const cancelPayoutM = useApiMutation((entryId: string) => cancelSalaryPayout(businessId!, entryId));
  const refetchAll = () => {
    entriesQ.refetch();
    balanceQ.refetch();
  };

  const handleSheet = async () => {
    if (!range.from || !range.to) return;
    try {
      const res = await sheetM.mutate({ from: range.from, to: range.to, comment: '' });
      if (res.status !== 'created') return;
      toast.success(t('settlements.sheetCreated'));
      setSheetOpen(false);
      refetchAll();
    } catch {
      toast.error(t('settlements.actionFailed'));
    }
  };

  const handleEntry = async () => {
    if (!entryOpen || !entryAmount || entryAmount <= 0) return;
    try {
      await entryM.mutate({
        kind: entryOpen,
        label: entryLabel.trim() || t(`settlements.kind.${entryOpen}`),
        amount: entryAmount,
        comment: entryComment.trim(),
      });
      toast.success(t('settlements.entryCreated'));
      setEntryOpen(null);
      setEntryLabel('');
      setEntryAmount(undefined);
      setEntryComment('');
      refetchAll();
    } catch {
      toast.error(t('settlements.actionFailed'));
    }
  };

  const handleDelete = async (entryId: string) => {
    const ok = await confirm({
      title: t('settlements.deleteTitle'),
      description: t('settlements.deleteText'),
      tone: 'danger',
      confirmLabel: t('settlements.deleteConfirm'),
    });
    if (!ok) return;
    try {
      await deleteM.mutate(entryId);
      toast.success(t('settlements.deleted'));
      refetchAll();
    } catch {
      toast.error(t('settlements.actionFailed'));
    }
  };

  const handleCancelPayout = async (entryId: string) => {
    // F-07-160 (добавлено проверкой 2) — отмена выплаты возвращает сумму и в кассу, и в баланс взаиморасчётов
    const ok = await confirm({
      title: t('settlements.cancelPayoutTitle'),
      description: t('settlements.cancelPayoutText'),
      tone: 'danger',
      confirmLabel: t('settlements.cancelPayoutConfirm'),
    });
    if (!ok) return;
    try {
      await cancelPayoutM.mutate(entryId);
      toast.success(t('settlements.payoutCancelled'));
      refetchAll();
    } catch {
      toast.error(t('settlements.actionFailed'));
    }
  };

  const balance = balanceQ.data ?? 0;
  const openPayout = () => setPayoutOpen(true);

  // Пока грузится список сотрудников — та же страница (шапка, карточка баланса, журнал), серые места вместо данных
  const staffLoading = !ready || staffQ.isLoading;

  if (!staffLoading && staffQ.isError) return <ErrorState onRetry={staffQ.refetch} />;

  if (!staffLoading && staffList.length === 0) {
    return (
      <div className="flex w-full flex-col gap-6">
        <PageHeader title={t('nav.settlements')} />
        <EmptyState icon={<Users aria-hidden className="size-8" />} title={t('settlements.noStaff')} />
      </div>
    );
  }

  return (
    <div data-f="F-07-159 F-09-073 F-09-074 F-09-075 F-09-077 F-09-078" className="flex w-full flex-col gap-6">
      <PageHeader
        title={t('nav.settlements')}
        description={t('settlements.subtitle')}
        actions={
          !ownOnly && (
            <div className="w-full min-w-48 sm:w-56">
              <Select
                value={effectiveStaffId}
                onValueChange={setStaffId}
                placeholder={t('settlements.pickStaff')}
                options={staffList.map((s) => ({ value: s.id, label: s.name }))}
                disabled={staffLoading}
                searchable
              />
            </div>
          )
        }
      />

      {!effectiveStaffId ? (
        <EmptyState icon={<Users aria-hidden className="size-8" />} title={t('settlements.pickStaffHint')} />
      ) : (
        <>
          <SectionCard title={staffLoading ? <SkeletonText width="16ch" /> : (staff?.name ?? '—')} padding="sm">
            <StatCard label={t('settlements.balance')} value={format.money(balance)} loading={staffLoading || balanceQ.isLoading} />
            {canAccrue && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  data-f="F-07-162"
                  size="sm"
                  variant="secondary"
                  leftIcon={<Users aria-hidden className="size-4" />}
                  onClick={() => setSheetOpen(true)}
                >
                  {t('settlements.createSheet')}
                </Button>
                <Button
                  data-f="F-07-161"
                  size="sm"
                  variant="secondary"
                  leftIcon={<Gift aria-hidden className="size-4" />}
                  onClick={() => setEntryOpen('bonus')}
                >
                  {t('settlements.addBonus')}
                </Button>
                <Button
                  data-f="F-07-161"
                  size="sm"
                  variant="secondary"
                  leftIcon={<Minus aria-hidden className="size-4" />}
                  onClick={() => setEntryOpen('penalty')}
                >
                  {t('settlements.addPenalty')}
                </Button>
                <Button
                  data-f="F-07-161"
                  size="sm"
                  variant="secondary"
                  leftIcon={<Plus aria-hidden className="size-4" />}
                  onClick={() => setEntryOpen('adjustment')}
                >
                  {t('settlements.addAdjustment')}
                </Button>
                <Button
                  data-f="F-07-160 F-09-079"
                  size="sm"
                  leftIcon={<Banknote aria-hidden className="size-4" />}
                  onClick={openPayout}
                  disabled={accountsQ.data?.length === 0}
                >
                  {t('settlements.payout')}
                </Button>
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('settlements.ledgerTitle')} padding="sm">
            {entriesQ.isError ? (
              <ErrorState onRetry={entriesQ.refetch} />
            ) : staffLoading || entriesQ.isLoading ? (
              // У большинства сотрудников в демо журнал пуст — скелетон той же высоты, что «Пока нет начислений»
              <EmptyState compact icon={<Users aria-hidden className="size-6" />} title={<SkeletonText width="18ch" />} />
            ) : !entriesQ.data || entriesQ.data.length === 0 ? (
              <EmptyState compact icon={<Users aria-hidden className="size-6" />} title={t('settlements.ledgerEmpty')} />
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {entryPage.map((entry) => {
                    const Icon = KIND_ICON[entry.kind];
                    const sign = entry.kind === 'penalty' || entry.kind === 'payout' ? -1 : 1;
                    return (
                      <li key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted">
                            <Icon aria-hidden className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{entry.label}</p>
                            <p className="text-xs text-muted">
                              {format.date(entry.createdAt, 'short')}
                              {entry.comment ? ` · ${entry.comment}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium tabular-nums ${sign > 0 ? 'text-success' : 'text-danger'}`}>
                            {sign > 0 ? '+' : '−'}
                            {format.money(entry.amount)}
                          </span>
                          {canAccrue && entry.kind !== 'payout' && (
                            <IconButton
                              data-f="F-09-076"
                              icon={<Trash2 aria-hidden className="size-4" />}
                              label={t('settlements.deleteEntry')}
                              onClick={() => handleDelete(entry.id)}
                              disabled={deleteM.isPending}
                            />
                          )}
                          {canAccrue && entry.kind === 'payout' && (
                            <IconButton
                              data-f="F-09-109"
                              icon={<Trash2 aria-hidden className="size-4" />}
                              label={t('settlements.cancelPayout')}
                              onClick={() => handleCancelPayout(entry.id)}
                              disabled={cancelPayoutM.isPending}
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {entryPager}
              </>
            )}
          </SectionCard>
        </>
      )}

      {/* F-07-162 — создать расчётную ведомость */}
      <Modal open={sheetOpen} onOpenChange={setSheetOpen} title={t('settlements.createSheet')} description={t('settlements.createSheetHint')}>
        <div className="flex flex-col gap-3">
          <DateRangePicker value={range} onValueChange={setRange} presets />
          <Button loading={sheetM.isPending} disabled={!range.from || !range.to} onClick={handleSheet}>
            {t('settlements.createSheetConfirm')}
          </Button>
        </div>
      </Modal>

      {/* F-07-161 — премия/штраф/внеочередное начисление */}
      <Modal open={entryOpen !== null} onOpenChange={(o) => !o && setEntryOpen(null)} title={entryOpen ? t(`settlements.kind.${entryOpen}`) : ''}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('settlements.entryLabel')}</span>
            <Input value={entryLabel} onChange={(e) => setEntryLabel(e.target.value)} placeholder={t('settlements.entryLabelPlaceholder')} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('settlements.amount')}</span>
            <MoneyInput value={entryAmount} onValueChange={setEntryAmount} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t('settlements.comment')}</span>
            <Textarea value={entryComment} onChange={(e) => setEntryComment(e.target.value)} rows={2} />
          </label>
          <Button loading={entryM.isPending} disabled={!entryAmount || entryAmount <= 0} onClick={handleEntry}>
            {t('settlements.entryConfirm')}
          </Button>
        </div>
      </Modal>

      {/* F-07-160 — выдать зарплату: одно окно с ведомостью (ответ 28, 17.11.2026) */}
      {effectiveStaffId && (
        <SalaryPayoutModal
          open={payoutOpen}
          onOpenChange={setPayoutOpen}
          businessId={businessId!}
          locationId={staff?.locationIds[0] ?? ''}
          staffId={effectiveStaffId}
          balance={balance}
          onDone={() => {
            refetchAll();
            accountsQ.refetch();
          }}
        />
      )}
    </div>
  );
}
