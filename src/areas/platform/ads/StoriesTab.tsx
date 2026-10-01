'use client';

/** Сторис (F-00-160, F-00-162): сначала доска мест по дням, потом статистика; настройки мест — в шторке. */
import { useState } from 'react';
import { DISTRICT_IDS } from '@/config/districts';
import type { DistrictId } from '@/domain/core';
import { StoryDayRow } from '@/areas/platform/ads/StoryDayRow';
import { StoryStatsList } from '@/areas/platform/ads/StoryStatsList';
import { useStoryBoard } from '@/areas/platform/hooks/usePlatformData';
import { useT } from '@/i18n/useT';
import { ErrorState } from '@/ui/ErrorState';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';
import { SkeletonList } from '@/ui/Skeleton';

export function StoriesTab() {
  const t = useT('platform');
  const tc = useT('common');
  const [district, setDistrict] = useState<DistrictId | 'all'>('all');
  const q = useStoryBoard(district);

  if (q.isError) return <ErrorState onRetry={q.refetch} />;
  if (q.isLoading || !q.data) return <SkeletonList rows={6} avatar={false} />;
  const board = q.data;
  const shown = board.days.flatMap((d) => d.bookings.filter((b) => b.shown));

  return (
    <div data-f="F-00-160" className="flex flex-col gap-6">
      <SectionCard
        title={t('ads.boardTitle')}
        description={t('ads.boardHint', { places: board.config.places, price: board.config.pricePerDay })}
        padding="none"
          classNames={{ body: 'mt-4 border-t border-border' }}
        actions={
          board.config.scope === 'district' ? (
            <Select
              aria-label={t('ads.scope')}
              size="sm"
              value={district}
              onValueChange={(v) => setDistrict(v as DistrictId | 'all')}
              options={[{ value: 'all', label: t('ads.allDistricts') }, ...DISTRICT_IDS.map((d) => ({ value: d, label: tc(`districts.${d}`) }))]}
            />
          ) : undefined
        }
      >
        <ul className="flex flex-col divide-y divide-border">
          {board.days.map((d) => (
            <StoryDayRow key={d.date} day={d} />
          ))}
        </ul>
      </SectionCard>

      <section data-f="F-00-162" className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold text-fg">{t('ads.storyStatsTitle')}</h2>
          <p className="text-sm text-muted">{t('ads.storyStatsHint')}</p>
        </div>
        <StoryStatsList rows={shown} />
      </section>
    </div>
  );
}
