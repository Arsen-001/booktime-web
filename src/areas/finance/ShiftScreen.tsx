'use client';

/**
 * /biz/finance/shift — «Кассовая смена» (владелец, 01.10.2026: смену ведёт администратор). Только наличные кассы
 * филиала и строка смены у каждой: открыть (пересчёт ящика), закрыть, Z-отчёт текущей и последней смены.
 * Право finance.shift (или finance.edit) — остальной раздел «Финансы» администратору с одним этим правом закрыт.
 */
import { Wallet } from 'lucide-react';
import { listAccountsWithBalance } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { CashShiftPanel } from '@/areas/finance/shift/CashShiftPanel';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SkeletonText } from '@/ui/Skeleton';

export function ShiftScreen() {
  const t = useT('finance');
  const { ready, businessId, activeLocationIds } = useCurrent();
  const canShift = useCan('finance.shift');
  const canEdit = useCan('finance.edit');
  const accountsQ = useApiQuery(['finance', 'accounts', businessId, activeLocationIds], () => listAccountsWithBalance(businessId!, activeLocationIds), {
    enabled: ready && Boolean(businessId),
  });
  const cash = (accountsQ.data ?? []).filter((a) => a.kind === 'cash');

  return (
    <div data-f="F-07-001" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('shift.screenTitle')} description={t('shift.screenSubtitle')} />
      {accountsQ.isError ? (
        <ErrorState onRetry={() => accountsQ.refetch()} />
      ) : !accountsQ.data ? (
        <Card>
          <SkeletonText width="20ch" />
        </Card>
      ) : cash.length === 0 ? (
        <EmptyState icon={<Wallet aria-hidden className="size-7" />} title={t('shift.noCash')} />
      ) : (
        cash.map((acc) => (
          <Card key={acc.id}>
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-base font-semibold">
                <Wallet aria-hidden className="size-4 text-muted" />
                {acc.name}
              </p>
              {businessId && <CashShiftPanel businessId={businessId} accountId={acc.id} canEdit={canShift || canEdit} balance={acc.balance} />}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
