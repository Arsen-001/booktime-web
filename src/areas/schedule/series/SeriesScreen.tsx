'use client';

/**
 * Повторяющиеся записи (F-00-064): «клиент ходит каждый третий день» или «каждый вторник в 15:00».
 * Правило и генерацию ведёт раздел schedule; журнал показывает созданные записи. Шапка и ошибка — всегда на месте,
 * пустой список — одна кнопка в пустом состоянии (ux-r5 R-1).
 */
import { useEffect, useState } from 'react';
import { Plus, Repeat } from 'lucide-react';
import { useCoreList } from '@/api/core';
import { useApiMutation, useApiQuery } from '@/api/request';
import { extendDueSeries, listSeries } from '@/api/schedule';
import { useActorName } from '@/areas/schedule/lib/actor';
import { NewSeriesModal } from '@/areas/schedule/series/NewSeriesModal';
import { SeriesCard, SeriesCardSkeleton, seriesSkeletonRows } from '@/areas/schedule/series/SeriesCard';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { useToast } from '@/ui/Toast';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function SeriesScreen() {
  const t = useT('schedule');
  const toast = useToast();
  const { ready, businessId, staffId: ownStaffId, activeLocationIds } = useCurrent();
  const canOthers = useCan('journal.others');
  const canCreate = useCan('journal.create');
  const locationId = activeLocationIds[0];
  const actorName = useActorName();
  const [formOpen, setFormOpen] = useState(false);

  const seriesQuery = useApiQuery(
    ['schedule', 'series', businessId, canOthers ? '' : (ownStaffId ?? '')],
    () => listSeries(businessId ?? '', canOthers ? undefined : (ownStaffId ?? undefined)),
    { enabled: ready && Boolean(businessId) },
  );
  const staffQuery = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: ready && Boolean(businessId) && canOthers });
  const extend = useApiMutation(extendDueSeries);

  // F-00-064 «продлевает их сама»: при открытии экрана добираем горизонт у серий, которые к нему подошли — одним запросом
  useEffect(() => {
    if (!businessId || !ready) return;
    extend.mutate(businessId).catch(() => toast.error(t('series.extendFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, ready]);

  const rules = seriesQuery.data ?? [];
  const loading = !ready || seriesQuery.isLoading;
  // Карточек при загрузке — как в прошлый раз, иначе типичный салон демо (2 серии)
  const skeletonCount = useSkeletonCount('series', { loading, count: seriesQuery.data?.length, fallback: 2, max: 10 });
  const canAdd = Boolean(businessId && locationId && canCreate);
  const staffName = (id: string) => (canOthers ? staffQuery.data?.find((s) => s.id === id)?.name : undefined);

  return (
    <div data-f="F-00-064" className="flex flex-col gap-6">
      <PageHeader
        title={t('series.title')}
        description={t('series.subtitle')}
        actions={
          // Пока контекст грузится, филиал ещё неизвестен — кнопка на месте по праву «создавать записи»
          (loading ? canCreate : canAdd && rules.length > 0) ? (
            <Button leftIcon={<Plus aria-hidden />} onClick={() => setFormOpen(true)} disabled={loading}>
              {t('series.new')}
            </Button>
          ) : undefined
        }
      />

      {seriesQuery.isError ? (
        <ErrorState onRetry={() => seriesQuery.refetch()} />
      ) : loading ? (
        <div aria-busy className="flex flex-col gap-4">
          {Array.from({ length: skeletonCount }, (_, i) => (
            <SeriesCardSkeleton key={i} rows={seriesSkeletonRows(i)} />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={<Repeat aria-hidden />}
          title={t('series.emptyTitle')}
          description={t('series.emptyText')}
          action={
            canAdd ? (
              <Button leftIcon={<Plus aria-hidden />} onClick={() => setFormOpen(true)}>
                {t('series.new')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {rules.map((rule, i) => (
            <SeriesCard key={rule.id} rule={rule} staffName={staffName(rule.staffId)} skeletonRows={seriesSkeletonRows(i)} />
          ))}
        </div>
      )}

      {businessId && locationId && (
        <NewSeriesModal
          open={formOpen}
          onOpenChange={setFormOpen}
          businessId={businessId}
          locationId={locationId}
          fixedStaffId={canOthers ? undefined : (ownStaffId ?? undefined)}
          actorStaffId={ownStaffId ?? undefined}
          actorName={actorName}
        />
      )}
    </div>
  );
}
