'use client';

/** Как сработала каждая вышедшая сторис (F-00-162): бизнес, день, просмотры → нажатия → записи. */
import { BarChart3 } from 'lucide-react';
import type { StoryDayBooking } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { EmptyState } from '@/ui/EmptyState';
import { Table, type TableColumn } from '@/ui/Table';

export function StoryStatsList({ rows }: { rows: StoryDayBooking[] }) {
  const t = useT('platform');
  const fmt = useFormat();
  const columns: TableColumn<StoryDayBooking>[] = [
    { id: 'business', header: t('ads.storyBusiness'), mobile: 'title', cell: (b) => <span className="font-medium">{b.businessName}</span> },
    { id: 'day', header: t('ads.storyDay'), mobile: 'subtitle', cell: (b) => <span className="text-muted">{fmt.relativeDay(b.date)}</span> },
    { id: 'views', header: t('ads.storyViews'), align: 'right', mobile: 'meta', cell: (b) => fmt.number(b.views) },
    { id: 'clicks', header: t('ads.storyClicks'), align: 'right', mobile: 'meta', cell: (b) => fmt.number(b.clicks) },
    { id: 'bookings', header: t('ads.storyBookings'), align: 'right', mobile: 'meta', cell: (b) => fmt.number(b.bookingsFromStory) },
  ];
  return (
    <Table
      label={t('ads.storyStatsTitle')}
      columns={columns}
      rows={rows}
      rowKey={(b) => b.id}
      empty={<EmptyState variant="section" icon={<BarChart3 aria-hidden />} title={t('ads.storyStatsEmpty')} description={t('ads.storyStatsEmptyHint')} />}
    />
  );
}
