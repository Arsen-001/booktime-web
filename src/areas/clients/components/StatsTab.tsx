'use client';

/** Вкладка «Статистика» карточки клиента (F-04-077): выручка по периоду, любимые услуги и мастера. Раздел «clients». */
import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Bar, BarChart, CartesianGrid, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { listClientVisits } from '@/api/clients';
import { useCoreList } from '@/api/core';
import { useApiQuery } from '@/api/request';
import type { Service } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { pickText } from '@/lib/text';
import { addDays, parse, today } from '@/lib/date';
import { CHART_COLORS, ChartCard, chartTheme } from '@/ui/ChartCard';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';

export interface StatsTabProps {
  businessId: string;
  clientId: string;
  services: Service[];
  /** F-00-132: без права «Просмотр счетов» выручка и средний чек мастеру не показываются — только визиты */
  canViewAccounts: boolean;
}

export function StatsTab({ businessId, clientId, services, canViewAccounts }: StatsTabProps) {
  const t = useT('clients');
  const fmt = useFormat();
  const locale = useLocale();

  const [range, setRange] = useState<{ from: string; to: string }>(() => ({
    from: addDays(today(), -365),
    to: today(),
  }));

  const visitsQ = useApiQuery(['clients', 'visits', businessId, clientId], () => listClientVisits(businessId, clientId), {
    enabled: Boolean(businessId) && Boolean(clientId),
  });
  const staffQ = useCoreList('staff', { businessId }, { enabled: Boolean(businessId) });

  const inRange = useMemo(
    () => (visitsQ.data ?? []).filter((v) => v.status === 'arrived' && v.date.slice(0, 10) >= range.from && v.date.slice(0, 10) <= range.to),
    [visitsQ.data, range],
  );

  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    inRange.forEach((v) => {
      const key = v.date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + v.total);
    });
    // Все месяцы периода, и пустые тоже — один визит за год не растягивается столбцом на весь график (ux-r5 №13)
    const months: string[] = [];
    for (let m = parse(`${range.from.slice(0, 7)}-01`); m.format('YYYY-MM') <= range.to.slice(0, 7) && months.length < 36; m = m.add(1, 'month')) {
      months.push(m.format('YYYY-MM'));
    }
    return months.map((month) => ({ month: fmt.monthName(`${month}-01`).slice(0, 3), revenue: map.get(month) ?? 0 }));
  }, [inRange, range, fmt]);

  const topServices = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    inRange.forEach((v) =>
      v.services.forEach((line) => {
        const svc = services.find((s) => s.id === line.serviceId);
        const name = line.customName ?? (svc ? pickText(svc.name, locale as never) : t('card.history.noServices'));
        const row = map.get(name) ?? { name, revenue: 0, count: 0 };
        row.revenue += line.price;
        row.count += 1;
        map.set(name, row);
      }),
    );
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [inRange, services, locale, t]);

  const topStaff = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    inRange.forEach((v) => {
      const name = staffQ.data?.find((s) => s.id === v.staffId)?.name ?? v.staffId;
      const row = map.get(v.staffId) ?? { name, revenue: 0, count: 0 };
      row.revenue += v.total;
      row.count += 1;
      map.set(v.staffId, row);
    });
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [inRange, staffQ.data]);

  const totalRevenue = inRange.reduce((s, v) => s + v.total, 0);

  if (visitsQ.isError) return <ErrorState onRetry={visitsQ.refetch} />;
  if (visitsQ.isLoading) return <Skeleton lines={4} />;

  return (
    <div data-f="F-04-077" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t('card.stats.periodLabel')}</p>
        <DateRangePicker
          value={{ from: range.from as never, to: range.to as never }}
          onValueChange={(v) => v.from && v.to && setRange({ from: v.from, to: v.to })}
        />
      </div>

      <div data-f="F-00-132" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {canViewAccounts && <StatCard label={t('card.stats.revenue')} value={fmt.money(totalRevenue)} />}
        <StatCard label={t('card.stats.visits')} value={String(inRange.length)} />
        {canViewAccounts && (
          <StatCard label={t('card.stats.avgTicket')} value={fmt.money(inRange.length ? Math.round(totalRevenue / inRange.length) : 0)} />
        )}
      </div>

      {canViewAccounts && (
        <ChartCard title={t('card.stats.chartTitle')} height={220}>
          <BarChart data={byMonth}>
            <CartesianGrid {...chartTheme.grid} />
            <XAxis dataKey="month" {...chartTheme.axis} />
            <YAxis {...chartTheme.axis} width={64} tickFormatter={(v) => fmt.number(Number(v))} />
            <RTooltip {...chartTheme.tooltip} formatter={(value) => fmt.money(Number(value))} />
            <Bar dataKey="revenue" name={t('card.stats.revenue')} fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ChartCard>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { id: 'services', title: t('card.stats.topServices'), rows: topServices },
          { id: 'staff', title: t('card.stats.topStaff'), rows: topStaff },
        ].map((block) => (
          <SectionCard key={block.id} title={block.title}>
            {block.rows.length === 0 ? (
              <EmptyState variant="inline" title={t('card.stats.noData')} />
            ) : (
              <ul className="flex flex-col gap-2">
                {block.rows.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-2 text-base">
                    <span className="truncate text-fg">{s.name}</span>
                    {canViewAccounts ? (
                      <span className="shrink-0 tabular-nums text-muted">{fmt.money(s.revenue)}</span>
                    ) : (
                      <span className="shrink-0 tabular-nums text-muted">{t('card.stats.visitsCount', { count: s.count })}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        ))}
      </div>
    </div>
  );
}
