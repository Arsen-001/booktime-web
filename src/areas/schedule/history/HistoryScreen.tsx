'use client';

/**
 * История правок графика (F-02-102): кто, когда и что поменял. ⭐ Наш журнал (черновик F-00-040). Мастер видит только
 * правки своего графика и в пределах «доступа к истории» (F-02-085).
 */
import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { useCoreList } from '@/api/core';
import { useApiQuery } from '@/api/request';
import { getHistory, getHistoryLimitDays, isDateBeyondHistoryLimit } from '@/api/schedule';
import { HistoryEntryRow, HistoryEntryRowSkeleton } from '@/areas/schedule/history/HistoryEntryRow';
import { useCan, useCurrent } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { Select } from '@/ui/Select';
import { usePagedList } from '@/ui/Pagination';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function HistoryScreen() {
  const t = useT('schedule');
  const { ready, businessId, staffId: ownStaffId } = useCurrent();
  const restrictedToSelf = !useCan('journal.others');
  const [actorFilter, setActorFilter] = useState<string>('all');

  const historyQuery = useApiQuery(
    ['schedule', 'history', restrictedToSelf ? (ownStaffId ?? '') : ''],
    () => getHistory(restrictedToSelf && ownStaffId ? [ownStaffId] : undefined),
    { enabled: ready },
  );
  const historyLimitQuery = useApiQuery(['schedule', 'history-limit', ownStaffId], () => getHistoryLimitDays(ownStaffId ?? ''), {
    enabled: ready && Boolean(ownStaffId) && restrictedToSelf,
  });
  const staffQuery = useCoreList('staff', { businessId: businessId ?? '' }, { enabled: ready && Boolean(businessId) });
  const limitDays = restrictedToSelf ? historyLimitQuery.data : undefined;

  const all = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);
  const actors = useMemo(() => Array.from(new Set(all.map((h) => h.actorName))), [all]);
  const nameOf = (id: string) => staffQuery.data?.find((s) => s.id === id)?.name ?? '';
  const entries = all
    .filter((h) => limitDays === undefined || h.dates.length === 0 || h.dates.some((d) => !isDateBeyondHistoryLimit(d, limitDays)))
    .filter((h) => actorFilter === 'all' || h.actorName === actorFilter);
  // Постранично, как во всех списках (DESIGN.md → Long lists)
  const { pageItems, pager, pageSize } = usePagedList(entries, { resetKey: actorFilter });
  // Имена сотрудников в строках — из списка сотрудников: ждём и его, иначе «Весь филиал» сменялся бы именами
  const loading = !ready || historyQuery.isLoading || staffQuery.isLoading;
  // Строк при загрузке — как в прошлый раз (не больше страницы), иначе типичная история демо — 6 правок
  const skeletonRows = useSkeletonCount('history', { loading, count: pageItems.length || undefined, fallback: 6, max: pageSize });

  return (
    <div data-f="F-02-102 F-02-085" className="flex flex-col gap-6">
      <PageHeader
        title={t('history.title')}
        description={t('history.subtitle')}
        actions={
          (loading || actors.length > 1) && (
            <Select
              disabled={loading}
              aria-label={t('history.actorFilter')}
              className="w-auto min-w-44"
              value={actorFilter}
              onValueChange={setActorFilter}
              options={[{ value: 'all', label: t('history.allActors') }, ...actors.map((a) => ({ value: a, label: a }))]}
            />
          )
        }
      />

      {historyQuery.isError ? (
        <ErrorState onRetry={() => historyQuery.refetch()} />
      ) : loading ? (
        <ul aria-busy className="flex flex-col gap-2">
          {Array.from({ length: skeletonRows }, (_, i) => (
            <HistoryEntryRowSkeleton key={i} index={i} />
          ))}
        </ul>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<History aria-hidden />}
          title={actorFilter === 'all' ? t('history.emptyTitle') : t('table.emptyFilteredTitle')}
          description={actorFilter === 'all' ? t('history.emptyText') : undefined}
          kind={actorFilter === 'all' ? 'default' : 'search'}
          onReset={actorFilter === 'all' ? undefined : () => setActorFilter('all')}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {pageItems.map((h) => (
            <HistoryEntryRow
              key={h.id}
              entry={h}
              targets={h.targetStaffIds.map(nameOf).filter(Boolean).join(', ')}
              isMe={Boolean(ownStaffId) && h.actorStaffId === ownStaffId}
            />
          ))}
        </ul>
      )}
      {!historyQuery.isError && ready && pager}
    </div>
  );
}
