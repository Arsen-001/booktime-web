'use client';

/**
 * /biz/clients/summary — «Сводка по клиентам» (F-00-126, F-00-131; отметка после визита F-00-127).
 * Сотрудник без права на отчёты видит только свои визиты — считает api (ux-r5 №10, F-00-132), экран подписывает «Ваша выручка».
 * Бизнес без единого визита — одно пустое состояние с переходом в журнал вместо трёх нулей (onboarding-k2/k3).
 */
import { useState } from 'react';
import { ArrowRight, BarChart3, CalendarDays } from 'lucide-react';
import { getCrmSummary } from '@/api/clients';
import { useApiQuery } from '@/api/request';
import { MessageLogCard } from '@/areas/clients/components/summary/MessageLogCard';
import { PendingMarksCard } from '@/areas/clients/components/summary/PendingMarksCard';
import { useCurrent } from '@/demo/hooks';
import { today } from '@/lib/date';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { Avatar } from '@/ui/Avatar';
import { LinkButton } from '@/ui/Button';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { SectionCard } from '@/ui/SectionCard';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { StatCard } from '@/ui/StatCard';
import { useSkeletonCount } from '@/ui/hooks/useSkeletonCount';

export function CrmSummaryScreen() {
  const t = useT('clients');
  const fmt = useFormat();
  const { ready, businessId } = useCurrent();
  const [range, setRange] = useState(() => ({ from: `${today().slice(0, 8)}01`, to: today() }));
  const enabled = ready && Boolean(businessId);
  const summaryQ = useApiQuery(['clients', 'summary', businessId, range.from, range.to], () => getCrmSummary(businessId ?? '', range), { enabled });
  const s = summaryQ.data;
  const loading = !enabled || summaryQ.isLoading;
  const byStaffRows = useSkeletonCount('byStaff', { loading, count: s?.byStaff.length, fallback: 4, max: 12 });

  return (
    <div data-f="F-00-126 F-00-131" className="flex flex-col gap-6">
      <PageHeader
        title={t('summary.title')}
        description={t('summary.subtitle')}
        actions={
          <DateRangePicker
            value={{ from: range.from as never, to: range.to as never }}
            onValueChange={(v) => v.from && v.to && setRange({ from: v.from, to: v.to })}
            presets
          />
        }
      />

      {summaryQ.isError ? (
        <ErrorState title={t('summary.loadFailed')} onRetry={summaryQ.refetch} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            <StatCard
              className="max-sm:col-span-2"
              loading={loading}
              label={s?.ownOnly ? t('summary.ownRevenue') : t('summary.revenue')}
              value={fmt.money(s?.revenue ?? 0)}
            />
            <StatCard loading={loading} label={t('summary.clients')} value={fmt.number(s?.clientsCount ?? 0)} />
            <StatCard loading={loading} label={t('summary.visits')} value={fmt.number(s?.visitsCount ?? 0)} />
          </div>

          {/* F-04-123 F-04-124 F-04-125 F-04-163 F-04-185 F-04-222: новые/не новых/потерянные — только «Клиент пришел» с телефоном */}
          <div data-f="F-04-123 F-04-124 F-04-125 F-04-163 F-04-185 F-04-222">
            <SectionCard title={t('summary.clientBreakdown.title')} description={t('summary.clientBreakdown.description')}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { key: 'new', label: t('summary.clientBreakdown.new'), value: s?.newClients, pick: 'new' },
                  { key: 'repeat', label: t('summary.clientBreakdown.repeat'), value: s?.repeatClients, pick: 'repeat' },
                  { key: 'lost', label: t('summary.clientBreakdown.lost'), value: s?.lostClients, pick: 'lost' },
                  { key: 'rebooked', label: t('summary.clientBreakdown.rebooked'), value: s?.rebookedNoShows, pick: undefined },
                ].map((row) => (
                  <div key={row.key} className="flex flex-col gap-1 rounded-xl bg-surface-2 p-3">
                    <span className="text-xs text-muted">{row.label}</span>
                    <span className="text-lg font-semibold tabular-nums text-fg">{loading ? <SkeletonText width="3ch" /> : fmt.number(row.value ?? 0)}</span>
                    {row.pick && (
                      // Э1 (clients-review 27.09.2026): раньше выглядело простым текстом — теперь настоящая
                      // ссылка со стрелкой, variant="link" (DESIGN.md: цвет primary, подчёркивание на ховере).
                      <LinkButton
                        href={`/biz/clients?pick=${row.pick}`}
                        variant="link"
                        size="sm"
                        // Переносится по словам: hy «Դիտել հաճախորդներին» не влезал в половину ширины телефона
                        className="h-auto min-h-10 justify-start self-start px-0 text-left whitespace-normal md:min-h-9"
                        rightIcon={<ArrowRight aria-hidden className="size-4" />}
                      >
                        {t('summary.clientBreakdown.viewClients')}
                      </LinkButton>
                    )}
                  </div>
                ))}
              </div>
              {s?.networkLostClients !== undefined && (
                <p className="mt-3 text-xs text-muted">{t('summary.clientBreakdown.networkLost', { count: s.networkLostClients })}</p>
              )}
            </SectionCard>
          </div>

          {loading ? (
            // Та же карточка «По сотрудникам» со строками той же разметки — приход данных её не сдвигает
            <SectionCard title={t('summary.byStaffTitle')}>
              <ul className="flex flex-col gap-2" aria-busy>
                {Array.from({ length: byStaffRows }, (_, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                    <Skeleton variant="circle" className="size-8 shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-base font-medium text-fg">
                      <SkeletonText width={i % 2 ? '12ch' : '16ch'} />
                    </span>
                    <span className="shrink-0 text-right text-sm text-muted tabular-nums">
                      <span className="block font-semibold text-fg">
                        <SkeletonText width="9ch" />
                      </span>
                      <SkeletonText width="7ch" />
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : s && s.visitsCount === 0 ? (
            <EmptyState
              variant="section"
              framed
              icon={<CalendarDays aria-hidden />}
              title={t('summary.emptyTitle')}
              description={t('summary.emptyText')}
              action={
                <LinkButton href="/biz/journal" variant="outline">
                  {t('summary.openJournal')}
                </LinkButton>
              }
            />
          ) : (
            !s?.ownOnly &&
            (s?.byStaff.length ?? 0) > 1 && (
              <SectionCard title={t('summary.byStaffTitle')}>
                <ul className="flex flex-col gap-2">
                  {s?.byStaff.map((row) => (
                    <li key={row.staffId} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                      <Avatar name={row.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-base font-medium text-fg">{row.name}</span>
                      <span className="shrink-0 text-right text-sm text-muted tabular-nums">
                        <span className="block font-semibold text-fg">{fmt.money(row.revenue)}</span>
                        {t('summary.byStaffHours', { hours: Math.round(row.hoursBooked) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )
          )}
          {!loading && s && s.visitsCount > 0 && s.byStaff.length === 0 && (
            <EmptyState variant="inline" icon={<BarChart3 aria-hidden />} title={t('summary.byStaffEmptyTitle')} description={t('summary.byStaffEmptyText')} />
          )}
        </>
      )}

      {businessId && <PendingMarksCard businessId={businessId} />}
      {businessId && <MessageLogCard businessId={businessId} range={range} />}
    </div>
  );
}
