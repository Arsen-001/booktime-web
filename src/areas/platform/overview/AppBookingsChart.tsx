'use client';

/** Записи через приложение за неделю: итог в подписи, столбики по дням; ноль за неделю — пустое состояние с действием. */
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { LinkButton } from '@/ui/Button';
import { SkeletonText } from '@/ui/Skeleton';
import { CHART_COLORS, ChartCard, chartTheme } from '@/ui/ChartCard';

interface AppBookingsChartProps {
  days: { date: string; count: number }[];
  total: number;
  loading: boolean;
}

export function AppBookingsChart({ days, total, loading }: AppBookingsChartProps) {
  const t = useT('platform');
  const fmt = useFormat();
  const data = days.map((d) => ({ day: `${fmt.date(d.date, 'weekday').split(',')[0]} ${Number(d.date.slice(8, 10))}`, count: d.count }));
  return (
    <ChartCard
      title={t('overview.appBookingsChart')}
      description={loading ? <SkeletonText width="20ch" /> : t('overview.appBookingsTotal', { n: total })}
      loading={loading}
      empty={!loading && total === 0}
      emptyText={t('overview.appBookingsEmpty')}
      emptyAction={<LinkButton href="/platform/connect" variant="outline" size="sm">{t('overview.connectSalon')}</LinkButton>}
      height={220}
    >
      <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid {...chartTheme.grid} />
        <XAxis dataKey="day" {...chartTheme.axis} />
        <YAxis {...chartTheme.axis} width={32} allowDecimals={false} />
        <RTooltip {...chartTheme.tooltip} />
        <Bar dataKey="count" name={t('overview.bookings')} fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="count" position="top" fill="var(--text-muted)" fontSize={12} />
        </Bar>
      </BarChart>
    </ChartCard>
  );
}
