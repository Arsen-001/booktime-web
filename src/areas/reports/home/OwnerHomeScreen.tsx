'use client';

/**
 * ⭐ Главная владельца (владелец, 01.10.2026): вместо журнала владелец (и все, у кого есть reports.view) попадает
 * сюда — пять цифр, у каждой одно действие: выручка к плану месяца, загрузка мастеров, «записались снова», «не пришли»,
 * «пора позвать». Ниже — отдача от рассылок, если рассылки были. Пустой салон — «первые шаги».
 * Цифры считают ТЕ ЖЕ функции, что отчёты, куда ведут кнопки (getOwnerHome), поэтому совпадают с отчётами.
 */
import { CalendarCheck2 } from 'lucide-react';
import { useState } from 'react';
import { getOwnerHome } from '@/api/reports';
import { useApiQuery } from '@/api/request';
import { reportLink } from '@/areas/reports/reportPeriod';
import { useCan, useCurrent } from '@/demo/hooks';
import type { OwnerHomeData } from '@/domain/reports';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { addDays, dayjs, today } from '@/lib/date';
import { Button, LinkButton } from '@/ui/Button';
import { ErrorState } from '@/ui/ErrorState';
import { PageHeader } from '@/ui/PageHeader';
import { HomeClientsSheet } from './HomeClientsSheet';
import { HomeSetupCard } from './HomeSetupCard';
import { HomeTile } from './HomeTile';
import { MailingReturnCard } from './MailingReturnCard';
import { PlanModal } from './PlanModal';

type ListKind = 'due' | 'notRebooked';

export function OwnerHomeScreen() {
  const t = useT('reports');
  const f = useFormat();
  const { businessId, activeLocationIds, ready } = useCurrent();
  const canView = useCan('reports.view');

  const todayIso = today();
  const range = { from: addDays(todayIso, -29), to: todayIso };
  const month = todayIso.slice(0, 7);
  const monthLabel = f.date(`${month}-01`, 'monthYear');

  const q = useApiQuery(
    ['reports', 'home', businessId, activeLocationIds, range.from, range.to, month],
    () =>
      getOwnerHome({
        businessId: businessId ?? '',
        locationIds: activeLocationIds,
        range,
        month,
      }),
    { enabled: ready && Boolean(businessId) && canView, keepPrevious: true },
  );

  const [planOpen, setPlanOpen] = useState(false);
  const [list, setList] = useState<ListKind | null>(null);
  // Какой список был открыт — держим, пока шторка уезжает (иначе содержимое пропадает на анимации закрытия)
  const [lastList, setLastList] = useState<ListKind>('due');
  const openList = (kind: ListKind) => {
    setLastList(kind);
    setList(kind);
  };

  const loading = !ready || q.isLoading || !q.data;
  const data = q.data;

  return (
    <div data-f="F-00-195 F-12-009" className="flex flex-col gap-6">
      <PageHeader
        title={t('home.title')}
        description={t('home.description')}
        meta={
          // Пустой салон: «цифры за период» не о чем — строки нет (известно только после ответа, до него — на месте)
          !loading && data?.isEmpty ? undefined : (
            <span className="text-sm text-muted">
              {t('home.period', {
                range: `${f.date(range.from, 'dayMonthShort')} — ${f.date(range.to, 'dayMonthShort')}`,
              })}
            </span>
          )
        }
      />

      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !loading && data?.isEmpty ? (
        <HomeSetupCard setup={data.setup} />
      ) : (
        <>
          <Tiles data={data} loading={loading} range={range} month={month} monthLabel={monthLabel} onPlan={() => setPlanOpen(true)} onList={openList} />
          {(loading || data?.mailings) && <MailingReturnCard data={data?.mailings ?? null} loading={loading} />}
        </>
      )}

      {businessId && (
        <PlanModal open={planOpen} onOpenChange={setPlanOpen} businessId={businessId} month={month} monthLabel={monthLabel} goal={data?.plan.goal ?? null} />
      )}
      <HomeClientsSheet
        open={list !== null}
        onOpenChange={(open) => !open && setList(null)}
        title={lastList === 'due' ? t('home.list.dueTitle') : t('home.list.notRebookedTitle')}
        description={lastList === 'due' ? t('home.list.dueDescription') : t('home.list.notRebookedDescription')}
        clients={(lastList === 'due' ? data?.due.clients : data?.rebooking.notRebooked) ?? []}
        total={(lastList === 'due' ? data?.due.count : (data?.rebooking.visited ?? 0) - (data?.rebooking.rebooked ?? 0)) ?? 0}
      />
    </div>
  );
}

interface TilesProps {
  data: OwnerHomeData | undefined;
  loading: boolean;
  range: { from: string; to: string };
  month: string;
  monthLabel: string;
  onPlan: () => void;
  onList: (kind: ListKind) => void;
}

function Tiles({ data, loading, range, month, monthLabel, onPlan, onList }: TilesProps) {
  const t = useT('reports');
  const f = useFormat();
  const plan = data?.plan;
  const load = data?.load;
  const reb = data?.rebooking;
  const noShow = data?.noShow;
  const due = data?.due;

  // Темп плана: какая доля месяца прошла к сегодняшнему дню (включая сегодня)
  const todayIso = range.to;
  const daysInMonth = dayjs(`${month}-01`).daysInMonth();
  const pacePct = Math.round((Number(todayIso.slice(8, 10)) / daysInMonth) * 100);
  const goal = plan?.goal ?? null;
  const planPct = plan?.percent ?? 0;
  const paceShort = goal ? Math.max(0, Math.round((goal * pacePct) / 100) - (plan?.revenue ?? 0)) : 0;
  const planStatus = !plan
    ? ''
    : !goal
      ? t('home.plan.noPlan')
      : planPct >= 100
        ? t('home.plan.done')
        : paceShort > 0
          ? t('home.plan.behind', { amount: f.money(paceShort) })
          : t('home.plan.ahead');
  const monthRange = { from: `${month}-01`, to: todayIso };

  const noShowLink = `/biz/reports/r/appointments?${new URLSearchParams({ visitFrom: range.from, visitTo: range.to, status: 'no_show' }).toString()}`;
  const noSchedule = !loading && load !== undefined && load.scheduledHours === 0;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
      <HomeTile
        data-f="F-00-195"
        className="col-span-2 xl:col-span-1"
        label={t('home.plan.label', { month: monthLabel })}
        hint={t('home.plan.hint')}
        value={plan ? f.money(plan.revenue) : ''}
        sub={
          plan ? (
            <>
              {goal ? <span className="text-fg">{t('home.plan.ofGoal', { goal: f.money(goal), pct: planPct })}</span> : null}
              {goal ? ' · ' : null}
              {planStatus}
            </>
          ) : (
            ''
          )
        }
        progress={{
          pct: planPct,
          pacePct: goal ? pacePct : undefined,
          label: t('home.plan.progressLabel', { pct: planPct, pace: pacePct }),
        }}
        loading={loading}
        action={
          <Button variant={goal ? 'secondary' : 'outline'} size="sm" disabled={loading} onClick={onPlan}>
            {goal ? t('home.plan.edit') : t('home.plan.set')}
          </Button>
        }
        secondary={
          <LinkButton href={reportLink('/biz/reports', monthRange)} variant="ghost" size="sm">
            {t('home.reportLink')}
          </LinkButton>
        }
      />

      <HomeTile
        label={t('home.load.label')}
        hint={t('home.load.hint')}
        value={load ? (load.pct === null ? '—' : `${load.pct}%`) : ''}
        sub={
          load
            ? noSchedule
              ? t('home.load.noSchedule')
              : t('home.load.sub', {
                  worked: load.workedHours,
                  scheduled: load.scheduledHours,
                })
            : ''
        }
        loading={loading}
        action={
          noSchedule ? (
            <LinkButton href="/biz/schedule" variant="secondary" size="sm">
              {t('home.load.setSchedule')}
            </LinkButton>
          ) : (
            <LinkButton href={reportLink('/biz/reports/r/workload', range)} variant="secondary" size="sm" aria-disabled={loading || undefined}>
              {t('home.load.action')}
            </LinkButton>
          )
        }
      />

      <HomeTile
        label={t('home.rebooking.label')}
        hint={t('home.rebooking.hint')}
        value={reb ? (reb.pct === null ? '—' : `${reb.pct}%`) : ''}
        sub={reb ? (reb.visited === 0 ? t('home.rebooking.nobody') : t('home.rebooking.sub', { n: reb.rebooked, total: reb.visited })) : ''}
        loading={loading}
        action={
          <Button variant="secondary" size="sm" disabled={loading || !reb || reb.visited === reb.rebooked} onClick={() => onList('notRebooked')}>
            {t('home.rebooking.action')}
          </Button>
        }
      />

      <HomeTile
        label={t('home.noShow.label')}
        hint={t('home.noShow.hint')}
        value={noShow ? noShow.count : ''}
        tone={noShow && noShow.count > 0 ? 'warning' : 'default'}
        sub={noShow ? (noShow.count === 0 ? t('home.noShow.none') : t('home.noShow.sub', { pct: noShow.pct ?? 0 })) : ''}
        loading={loading}
        action={
          <LinkButton href={noShowLink} variant="secondary" size="sm" aria-disabled={loading || !noShow || noShow.count === 0 || undefined}>
            {t('home.noShow.action')}
          </LinkButton>
        }
      />

      <HomeTile
        label={t('home.due.label')}
        hint={t('home.due.hint')}
        value={due ? due.count : ''}
        tone={due && due.count > 0 ? 'primary' : 'default'}
        sub={due ? (due.count === 0 ? t('home.due.none') : t('home.due.sub')) : ''}
        loading={loading}
        action={
          <Button size="sm" leftIcon={<CalendarCheck2 aria-hidden />} disabled={loading || !due || due.count === 0} onClick={() => onList('due')}>
            {t('home.due.action')}
          </Button>
        }
      />
    </div>
  );
}
