'use client';

/** /platform — обзор: кому перезвонить, что ждёт действия (плитки-ссылки), записи через приложение, прогресс волн. */
import { LifeBuoy, SearchX, ShieldCheck, Store } from 'lucide-react';
import { CallbackList } from '@/areas/platform/components/CallbackList';
import { AppBookingsChart } from '@/areas/platform/overview/AppBookingsChart';
import { OverviewTile } from '@/areas/platform/overview/OverviewTile';
import { WavesCard } from '@/areas/platform/overview/WavesCard';
import { useOverview } from '@/areas/platform/hooks/usePlatformData';
import { useT } from '@/i18n/useT';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';

export function OverviewScreen() {
  const t = useT('platform');
  const q = useOverview();
  const d = q.data;
  const loading = q.isLoading || !d;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('overview.title')} description={t('overview.subtitle')} />
      {q.isError ? (
        <ErrorState onRetry={q.refetch} />
      ) : (
        <>
          <CallbackList items={d?.callbacks ?? []} loading={loading} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <OverviewTile href="/platform/moderation" label={t('overview.pendingModeration')} value={d?.pendingModeration ?? 0} hint={t('overview.check')} icon={<ShieldCheck aria-hidden />} loading={loading} attention />
            <OverviewTile href="/platform/support" label={t('overview.openTickets')} value={d?.openTickets ?? 0} hint={t('overview.answer')} icon={<LifeBuoy aria-hidden />} loading={loading} attention />
            <OverviewTile href="/platform/businesses" label={t('overview.connectedWeek')} value={d?.connectedWeek ?? 0} icon={<Store aria-hidden />} loading={loading} />
            <OverviewTile href="/platform/demand" label={t('overview.demandWithoutOffer')} value={d?.demandWithoutOffer ?? 0} icon={<SearchX aria-hidden />} loading={loading} />
          </div>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <AppBookingsChart days={d?.appBookings ?? []} total={d?.appBookingsTotal ?? 0} loading={loading} />
            <WavesCard waves={d?.waves ?? []} loading={loading} />
          </div>
        </>
      )}
    </div>
  );
}
