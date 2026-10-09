'use client';

import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { listLoyaltyCards, type LoyaltyCardRow } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { LoginGate } from '@/areas/client/ui/GuestGate';
import type { CashbackEarnRule } from '@/domain/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { Skeleton } from '@/ui/Skeleton';
import { useToast } from '@/ui/Toast';

function earnRuleText(t: ReturnType<typeof useT<'client'>>, fmt: ReturnType<typeof useClientFormat>, rule: CashbackEarnRule): string {
  if (rule.kind === 'fixed') {
    return rule.isPercent ? t('cashback.earnFixed', { rate: rule.rate }) : t('cashback.earnFixedMoney', { rate: rule.rate });
  }
  if (rule.kind === 'per_visit_count') {
    return t('cashback.earnPerVisit', { rate: rule.rate, count: rule.toNextLevel ?? 0 });
  }
  return t('cashback.earnPerSpend', { rate: rule.rate, amount: fmt.money(rule.toNextLevel ?? 0) });
}

/** Карты лояльности клиента, вкладка «Loyalty cards» (F-14-054) */
export function LoyaltyCardsScreen() {
  const t = useT('client');
  const { ready, appUserId } = useCurrent();
  const q = useApiQuery(['loyalty-cards', appUserId], () => listLoyaltyCards(appUserId!), {
    enabled: ready && Boolean(appUserId),
  });
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager } = usePagedList(q.data ?? []);

  return (
    <div data-f="F-14-054" className="flex flex-col gap-5 pb-6">
      <PageHeader title={t('loyalty.cardsTitle')} />
      {ready && !appUserId ? (
        <LoginGate icon={<CreditCard aria-hidden className="size-8 text-muted" />} next="/loyalty-cards" />
      ) : !ready || q.isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton variant="rect" className="h-32 rounded-2xl" />
        </div>
      ) : q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : !q.data?.length ? (
        <EmptyState icon={<CreditCard aria-hidden className="size-8 text-muted" />} title={t('loyalty.emptyTitle')} description={t('loyalty.emptyHint')} />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {pageItems.map((card) => (
              <LoyaltyCardRowItem key={card.id} card={card} />
            ))}
          </div>
          {pager}
        </>
      )}
    </div>
  );
}

function LoyaltyCardRowItem({ card }: { card: LoyaltyCardRow }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(card.cardNumber);
      setCopied(true);
      toast.success(t('loyalty.cardNumberCopied'));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t('loyalty.copyFailed'));
    }
  };

  return (
    <Card padding="md" className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span data-f="F-14-042">
          <Avatar name={card.businessName} src={card.businessLogoUrl} size="md" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-fg">{card.businessName}</p>
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="-ml-1 mt-0.5 flex min-h-11 items-center truncate rounded-md px-1 text-left text-sm text-primary-text hover:bg-surface-2 hover:underline"
          >
            {t('loyalty.cardNumber')}: {card.cardNumber}
            {copied ? ` · ${t('loyalty.copied')}` : ''}
          </button>
        </div>
        <span className="shrink-0 font-medium text-fg">{fmt.money(card.balance)}</span>
      </div>
      {(card.discountText || card.earnRules.length > 0) && (
        <div className="rounded-lg bg-surface-2 p-3 text-sm text-fg">
          <p className="mb-1 font-medium text-muted">{t('loyalty.discountsTitle')}</p>
          {card.discountText && <p>{card.discountText}</p>}
          {card.earnRules.map((r, i) => (
            <p key={i} className="text-muted">
              {earnRuleText(t, fmt, r)}
            </p>
          ))}
        </div>
      )}
    </Card>
  );
}
