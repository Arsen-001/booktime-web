'use client';

/**
 * /biz/loyalty/cards/[cardId] — страница карты в сети (F-06-059): владелец, тип, баланс, акции типа
 * карты и все операции.
 */
import { getCard, getCardSoldPaid } from '@/api/loyalty';
import Link from 'next/link';
import { useApiQuery } from '@/api/request';
import { LoyaltyCardVisual } from '@/areas/loyalty/components/LoyaltyCardVisual';
import { useCurrent } from '@/demo/hooks';
import type { Id } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { KeyValueList } from '@/ui/KeyValueList';
import { LinkButton } from '@/ui/Button';
import { PageHeader } from '@/ui/PageHeader';
import { usePagedList } from '@/ui/Pagination';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';

export function CardDetailScreen({ cardId }: { cardId: Id }) {
  const t = useT('loyalty');
  const format = useFormat();
  const { ready, businessId } = useCurrent();

  const q = useApiQuery(['loyalty', 'card', businessId, cardId], () => getCard(businessId!, cardId), { enabled: ready && Boolean(businessId) });
  const soldPaidQ = useApiQuery(['loyalty', 'cardSoldPaid', businessId, cardId], () => getCardSoldPaid(businessId!, cardId), { enabled: ready && Boolean(businessId) });

  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems: txPage, pager: txPager } = usePagedList(q.data?.transactions ?? []);

  if (q.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
        <Skeleton variant="rect" className="h-24" />
        <Skeleton lines={6} />
      </div>
    );
  }
  if (q.isError || !q.data) return <ErrorState onRetry={q.refetch} />;

  const card = q.data;

  return (
    <div data-f="F-06-059" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('cardDetail.title', { number: card.number })} back={{ href: '/biz/loyalty/cards' }} />

      {/* Карта — как настоящая банковская карта, баланс рядом крупным числом (ТЗ владельца) */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
        <LoyaltyCardVisual number={card.number} holderName={card.clientName} typeName={card.cardTypeName} className="sm:shrink-0" />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted">{t('cardDetail.balance')}</p>
          <p className="num-display text-fg">{format.money(card.balance)}</p>
          {Boolean(card.maxPercentDiscount) && <Badge tone="primary">{t('cardDetail.maxPercent')} · {card.maxPercentDiscount}%</Badge>}
        </div>
      </div>

      <div data-f="F-06-048" className="grid grid-cols-2 gap-3">
        <StatCard label={t('cardDetail.sold')} value={format.money(soldPaidQ.data?.sold ?? 0)} loading={soldPaidQ.isLoading} />
        <StatCard label={t('cardDetail.paid')} value={format.money(soldPaidQ.data?.paid ?? 0)} loading={soldPaidQ.isLoading} />
      </div>

      <SectionCard title={t('cardDetail.general')}>
        <KeyValueList
          items={[
            {
              label: t('cardDetail.owner'),
              value: (
                <Link href={`/biz/clients/${card.clientId}`} className="inline-flex min-h-10 items-center text-primary-text underline decoration-border-strong underline-offset-2">
                  {card.clientName} · {format.phone(card.clientPhone)}
                </Link>
              ),
            },
            { label: t('cardDetail.type'), value: card.cardTypeName },
            { label: t('cardDetail.createdAt'), value: format.date(card.createdAt, 'long') },
          ]}
        />
      </SectionCard>

      <SectionCard title={t('cardDetail.promotions')}>
        {card.promotions.length === 0 ? (
          <EmptyState compact title={t('cardDetail.noPromotions')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {card.promotions.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
                <span className="text-fg">{p.name}</span>
                <Badge tone={p.kind.startsWith('discount') ? 'primary' : 'accent'} size="sm">
                  {t(`promotions.kinds.${p.kind}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t('cardDetail.transactions')}>
        {card.transactions.length === 0 ? (
          <EmptyState compact title={t('cardDetail.noTransactions')} />
        ) : (
          <ul className="flex flex-col gap-2">
            {txPage.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-muted">
                  {format.date(tx.createdAt)} · {t(`transactions.types.${tx.type}`)}
                </span>
                <span className={tx.amount < 0 ? 'font-semibold text-danger' : 'font-semibold text-success'}>
                  {tx.amount > 0 ? '+' : ''}
                  {format.money(tx.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
        {txPager && <div className="mt-4">{txPager}</div>}
      </SectionCard>

      <LinkButton href="/biz/loyalty/cards" variant="outline" className="self-start">
        {t('cardDetail.back')}
      </LinkButton>
    </div>
  );
}
