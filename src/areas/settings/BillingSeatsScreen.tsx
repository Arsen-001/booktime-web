'use client';

/**
 * /biz/billing/seats — «Кто в плате» (F-15-049/052/046/053/054/078/079/080).
 * Мастера и администраторы с причиной платности; служебные интеграции — бесплатны и не считаются
 * (F-15-053); лимита мест нет — сумма пересчитывается сама (F-15-052); один человек в нескольких
 * филиалах у сети — каждый филиал считает своих (F-15-054). Н12: внутренних заметок («роль на будущее») на экране нет.
 */
import { ExternalLink, Info } from 'lucide-react';
import { getBillingSeats, getSubscription } from '@/api/settings';
import { useApiQuery } from '@/api/request';
import { useCurrent } from '@/demo/hooks';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { Button, LinkButton } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { SkeletonText } from '@/ui/Skeleton';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

/** Мест в плате у демо-салона — столько строк у скелетона, пока нет памяти о прошлом разе */
const TYPICAL_SEATS = 8;

export function BillingSeatsScreen() {
  const t = useT('settings');
  const format = useFormat();
  const { businessId, networkId, activeLocationIds, ready } = useCurrent();
  const isNetwork = Boolean(networkId) && activeLocationIds.length > 1;

  const seatsQ = useApiQuery(['settings', 'seats', businessId], () => getBillingSeats(businessId ?? ''), { enabled: ready && Boolean(businessId) });
  const subQ = useApiQuery(['settings', 'subscription', businessId], () => getSubscription(businessId ?? ''), { enabled: ready && Boolean(businessId) });

  // Строк мест — столько же, сколько было (иначе как в демо)
  const skeletonRows = useSkeletonCount('seats', { loading: !ready || seatsQ.isLoading || subQ.isLoading, count: seatsQ.data?.length, fallback: TYPICAL_SEATS });

  if (seatsQ.isError || subQ.isError) return <ErrorState onRetry={() => { seatsQ.refetch(); subQ.refetch(); }} />;

  const isLoading = !ready || seatsQ.isLoading || subQ.isLoading;
  const seats = seatsQ.data ?? [];
  const paidSeats = seats.filter((s) => s.paid);

  return (
    <div data-f="F-15-049" className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <PageHeader title={t('seats.title')} description={t('seats.description')} back={{ href: '/biz/billing' }} />

      {isNetwork && (
        <div className="flex items-start gap-2 rounded-lg bg-info-soft px-3 py-2.5 text-sm text-info">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span data-f="F-15-054">{t('seats.networkNote')}</span>
        </div>
      )}

      <SectionCard title={t('seats.paidTitle')} description={isLoading ? <SkeletonText width="24ch" /> : t('seats.paidDescription', { count: paidSeats.length })}>
        {isLoading ? (
          // Те же строки: имя, почему в плате, цена, «Открыть сотрудника»
          <ul aria-busy className="flex flex-col divide-y divide-border">
            {Array.from({ length: skeletonRows }, (_, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    <SkeletonText width="16ch" />
                  </span>
                  <span className="block text-xs text-muted">
                    <SkeletonText width="20ch" />
                  </span>
                </span>
                <span className="nums text-sm font-medium text-fg">
                  <SkeletonText width="9ch" />
                </span>
                <Button variant="ghost" size="sm" leftIcon={<ExternalLink aria-hidden />} disabled>
                  {t('seats.openStaff')}
                </Button>
              </li>
            ))}
          </ul>
        ) : seats.length === 0 ? (
          <EmptyState compact />
        ) : (
          <ul data-f="F-15-078 F-15-079 F-15-080" className="flex flex-col divide-y divide-border">
            {seats.map((seat) => (
              <li key={seat.staffId} data-f="F-02-022" className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">{seat.name}</span>
                  {/* Причина — одной строкой (многоточием на телефоне): строки одной высоты, скелетон им равен */}
                  <span className="block truncate text-xs text-muted">{t(`billing.seatReason.${seat.reasonKey}`)}</span>
                </span>
                <span className={seat.paid ? 'nums text-sm font-medium text-fg' : 'text-sm text-muted'}>
                  {seat.paid ? `${format.money(seat.price)}/${t('billing.perMonth')}` : t('billing.free')}
                </span>
                <LinkButton href={`/biz/staff/${seat.staffId}`} variant="ghost" size="sm" leftIcon={<ExternalLink aria-hidden />}>
                  {t('seats.openStaff')}
                </LinkButton>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={t('seats.freeTitle')} description={t('seats.freeDescription')}>
        <ul data-f="F-15-046" className="flex flex-col gap-2 text-sm text-fg">
          <li className="flex items-center gap-2"><Badge tone="neutral" size="sm">{t('seats.freeAdmin')}</Badge>{t('seats.freeAdminHint')}</li>
        </ul>
      </SectionCard>

      <SectionCard title={t('seats.techTitle')} description={t('seats.techDescription')}>
        <p data-f="F-15-053" className="text-sm text-muted">{t('seats.techHint')}</p>
      </SectionCard>

      <SectionCard title={t('seats.limitTitle')}>
        <p data-f="F-15-052" className="text-sm text-muted">{t('seats.limitHint')}</p>
      </SectionCard>

      <SectionCard title={t('seats.adviceTitle')}>
        <ul data-f="F-15-055" className="flex flex-col gap-2 text-sm text-muted">
          <li>{t('seats.adviceMaster')}</li>
          <li>{t('seats.adviceAdmin')}</li>
          <li>{t('seats.adviceReception')}</li>
        </ul>
      </SectionCard>
    </div>
  );
}
