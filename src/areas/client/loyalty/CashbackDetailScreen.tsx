'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { getCashbackForBusiness, getPlaceCard } from '@/api/client';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import type { CashbackCard, CashbackEarnRule } from '@/domain/client';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { pickText } from '@/lib/text';
import { Card } from '@/ui/Card';
import { LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';

/** Экран деталей кэшбэка компании: сумма, на что потратить, как заработать (F-14-049…052) */
export function CashbackDetailScreen({ businessId }: { businessId: Id }) {
  const t = useT('client');
  const fmt = useClientFormat();
  const router = useRouter();
  const locale = useLocale();
  const { ready, appUserId } = useCurrent();
  const cardQ = useApiQuery(['cashback-detail', businessId, appUserId], () => getCashbackForBusiness(appUserId, businessId), {
    enabled: ready,
  });
  const placeQ = useApiQuery(['place-card', businessId], () => getPlaceCard(businessId));

  if (!ready || cardQ.isLoading || placeQ.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton variant="rect" className="h-24 rounded-2xl" />
        <Skeleton variant="rect" className="h-40 rounded-2xl" />
      </div>
    );
  }
  if (cardQ.isError || placeQ.isError) return <ErrorState onRetry={() => { void cardQ.refetch(); void placeQ.refetch(); }} />;
  const card = cardQ.data;
  const place = placeQ.data;
  if (!place)
    return <EmptyState title={t('place.notFound')} action={<LinkButton href="/loyalty-cards">{t('loyalty.cardsTitle')}</LinkButton>} />;
  if (!card) {
    return (
      <div data-f="F-14-049" className="flex flex-col gap-5 pb-6">
        <PageHeader back={{ href: `/places/${businessId}` }} title={t('cashback.title')} description={place.business.name} />
        <EmptyState title={t('cashback.noProgram')} />
      </div>
    );
  }

  return (
    <div data-f="F-14-049 F-14-050 F-14-051" className="flex flex-col gap-5 pb-6">
      <PageHeader back={{ href: `/places/${businessId}` }} title={t('cashback.title')} description={place.business.name} />

      <Card padding="md" className="flex items-center justify-between">
        <span className="text-sm text-muted">{t('cashback.balanceTitle')}</span>
        <span className="text-2xl font-semibold text-fg">{fmt.money(card.balance)}</span>
      </Card>
      {card.balance === 0 && <p className="text-sm text-muted">{t('cashback.zeroHint')}</p>}

      <div data-f="F-14-050">
        <SectionCard title={t('cashback.spendTitle')}>
          <SpendRules card={card} />
        </SectionCard>
      </div>

      <div data-f="F-14-051">
        <SectionCard title={t('cashback.earnTitle')}>
          <ul className="flex flex-col gap-2 text-sm">
            {card.earnRules.map((r, i) => (
              <li key={i} className="rounded-lg bg-surface-2 p-3 text-fg">
                <EarnRuleLine rule={r} />
                {r.limitedToServiceNames && r.limitedToServiceNames.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1" data-f="F-14-052">
                    {r.limitedToServiceNames.map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          onClick={() => router.push(`/book?business=${businessId}`)}
                          className="min-h-9 text-left text-sm text-primary-text hover:underline"
                        >
                          {name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
      {/* Услуги места — переиспользуем как «нажми, чтобы записаться» (F-14-052), пока условия кэшбэка не сузили список */}
      <SectionCard title={t('place.servicesTitle')}>
        <ul className="flex flex-col divide-y divide-border">
          {place.services.slice(0, 5).map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => router.push(`/book?business=${businessId}&service=${s.id}`)}
                className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left"
              >
                <span className="text-fg">{pickText(s.name, locale)}</span>
                <span className="shrink-0 text-sm text-muted">{fmt.moneyRange(s.priceMin, s.priceMax)}</span>
              </button>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

function SpendRules({ card }: { card: CashbackCard }) {
  const t = useT('client');
  const fmt = useClientFormat();
  if (card.spendScope === 'blocked') return <p className="text-sm text-fg">{t('cashback.spendBlocked')}</p>;
  const scopeText =
    card.spendScope === 'services'
      ? t('cashback.spendServices')
      : card.spendScope === 'products'
        ? t('cashback.spendProducts')
        : t('cashback.spendAnythingBase');
  return (
    <div className="flex flex-col gap-1 text-sm text-fg">
      <p>{scopeText}</p>
      {card.spendLimitPercent !== undefined && <p className="text-muted">{t('cashback.spendLimitPercent', { percent: card.spendLimitPercent })}</p>}
      {card.spendLimitMoney !== undefined && (
        <p className="text-muted">{t('cashback.spendLimitMoney', { amount: fmt.money(card.spendLimitMoney) })}</p>
      )}
    </div>
  );
}

function EarnRuleLine({ rule }: { rule: CashbackEarnRule }) {
  const t = useT('client');
  const fmt = useClientFormat();
  if (rule.kind === 'fixed') {
    return <p>{rule.isPercent ? t('cashback.earnFixed', { rate: rule.rate }) : t('cashback.earnFixedMoney', { rate: rule.rate })}</p>;
  }
  if (rule.kind === 'per_visit_count') {
    return <p>{t('cashback.earnPerVisit', { rate: rule.rate, count: rule.toNextLevel ?? 0 })}</p>;
  }
  return <p>{t('cashback.earnPerSpend', { rate: rule.rate, amount: fmt.money(rule.toNextLevel ?? 0) })}</p>;
}
