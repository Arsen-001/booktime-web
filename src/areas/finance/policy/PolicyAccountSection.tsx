'use client';

/**
 * Счёт клиента «Payment Policy» (F-07-112) — только для чтения, создаётся сам при активной политике.
 * Balance/Available/Top-ups/Debits/Fees и история движений с источником. Вставляется из
 * extensions/ClientCard.tsx (вкладка «Деньги»). Пусто и без ошибок, если у бизнеса нет активной политики.
 */
import { listPolicyAccountEntries, getPaymentPolicy, getPolicyAccountSummary } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import type { PolicyAccountEntryKind } from '@/domain/finance';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { usePagedList } from '@/ui/Pagination';
import { Lock } from 'lucide-react';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';

const ENTRY_KIND_KEY: Record<
  PolicyAccountEntryKind,
  'policy.entryKind.topUp' | 'policy.entryKind.holdRelease' | 'policy.entryKind.holdConfirm' | 'policy.entryKind.feeCharge'
> = {
  topUp: 'policy.entryKind.topUp',
  holdRelease: 'policy.entryKind.holdRelease',
  holdConfirm: 'policy.entryKind.holdConfirm',
  feeCharge: 'policy.entryKind.feeCharge',
};

const ENTRY_SOURCE_KEY: Record<
  string,
  | 'policy.entrySource.widget'
  | 'policy.entrySource.checkout'
  | 'policy.entrySource.lateCancel'
  | 'policy.entrySource.noShow'
  | 'policy.entrySource.manual'
> = {
  widget: 'policy.entrySource.widget',
  checkout: 'policy.entrySource.checkout',
  lateCancel: 'policy.entrySource.lateCancel',
  noShow: 'policy.entrySource.noShow',
  manual: 'policy.entrySource.manual',
};

export function PolicyAccountSection({ businessId, clientId }: { businessId: string; clientId: string }) {
  const t = useT('finance');
  const format = useFormat();
  const policyQ = useApiQuery(['finance', 'policy', businessId], () => getPaymentPolicy(businessId), { enabled: Boolean(businessId) });
  const summaryQ = useApiQuery(['finance', 'policyAccount', businessId, clientId], () => getPolicyAccountSummary(businessId, clientId), {
    enabled: Boolean(businessId) && Boolean(clientId),
  });
  const entriesQ = useApiQuery(['finance', 'policyAccountEntries', businessId, clientId], () => listPolicyAccountEntries(businessId, clientId), {
    enabled: Boolean(businessId) && Boolean(clientId),
  });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: entriesPage, pager } = usePagedList(entriesQ.data ?? []);

  if (!policyQ.data || policyQ.data.mode === 'none') return null;

  if (!summaryQ.data || !entriesQ.data) {
    return (
      <div data-f="F-07-112 F-04-085">
        <SectionCard title={t('policy.accountTitle')}>
          <Skeleton lines={3} />
        </SectionCard>
      </div>
    );
  }

  const summary = summaryQ.data;
  const entries = entriesQ.data;

  return (
    <div data-f="F-07-112 F-07-122 F-04-178">
      <SectionCard
        title={t('policy.accountTitle')}
        description={
          <span className="flex items-center gap-1.5">
            <Lock aria-hidden className="size-3.5" />
            {t('policy.accountReadOnly')}
          </span>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label={t('policy.accountBalance')}
              value={<span className={summary.balance < 0 ? 'text-danger' : ''}>{format.money(summary.balance)}</span>}
            />
            <StatCard
              label={t('policy.accountAvailable')}
              value={<span className={summary.available < 0 ? 'text-danger' : ''}>{format.money(summary.available)}</span>}
            />
            <StatCard label={t('policy.accountTopUps')} value={format.money(summary.topUps)} />
            <StatCard label={t('policy.accountFees')} value={format.money(summary.fees)} />
          </div>

          <div data-f="F-07-129">
            <span className="text-sm font-medium">{t('policy.accountHistoryTitle')}</span>
            {entries.length === 0 ? (
              <EmptyState compact title={t('policy.accountEmpty')} className="mt-2" />
            ) : (
              <div className="mt-2 flex flex-col divide-y divide-border">
                {entriesPage.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="flex flex-col">
                      <span>{t(ENTRY_KIND_KEY[e.kind])}</span>
                      <span className="text-xs text-muted">
                        {format.dateTime(e.createdAt)} · {t(ENTRY_SOURCE_KEY[e.source] ?? 'policy.entrySource.manual')}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={e.amount < 0 ? 'font-medium text-danger' : 'font-medium'}>{format.money(e.amount)}</span>
                      <span className="text-xs text-muted">{format.money(e.balanceAfter)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pager && <div className="mt-2">{pager}</div>}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
