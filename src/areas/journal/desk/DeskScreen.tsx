'use client';

/**
 * Стойка администратора (⭐ рабочий день №10, 01.10.2026): планшет на ресепшене. Крупный список визитов сегодня —
 * «Опаздывают», «В ближайший час», «Позже сегодня», «В салоне» — и «Пришёл» одним касанием (отменить — в тосте).
 * Обновляется само: опрос каждые 15 с, в режиме api — ещё и живые события сервера (src/api/live.server.ts); визит,
 * который только что изменил кто-то другой, мигает рамкой (ForeignChangeHighlight). Вход — из журнала («⋯ Ещё»).
 *
 * Записи — тот же запрос, что у журнала (['journal', 'bookings', …, день]): «Пришёл» на стойке сразу виден в журнале
 * и наоборот. Мастер без права видеть чужие записи видит только свои (useJournalStaffScope).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { CalendarDays, Clock3, RefreshCw, UserCheck, UsersRound } from 'lucide-react';
import { coreList, listBookings } from '@/api/core';
import { useApiQuery } from '@/api/request';
import { ForeignChangeHighlight } from '@/areas/journal/components/ForeignChangeHighlight';
import { useDayListActions } from '@/areas/journal/components/DayListActions';
import { DeskVisitCard, DeskVisitCardSkeleton, type DeskCardTone } from '@/areas/journal/desk/DeskVisitCard';
import { deskGroups } from '@/areas/journal/desk/deskGroups';
import { useNowMinuteYerevan, useTodayYerevan } from '@/areas/journal/lib/lateness';
import { useJournalBlockRights, useJournalStaffScope } from '@/areas/journal/lib/rights';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import { useCan, useCurrent } from '@/demo/hooks';
import type { Booking, Id, Service } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Avatar } from '@/ui/Avatar';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { IconButton } from '@/ui/IconButton';
import { PageHeader } from '@/ui/PageHeader';
import { ScrollRow } from '@/ui/ScrollRow';
import { usePagedList } from '@/ui/Pagination';
import { LinkButton } from '@/ui/Button';
import { SkeletonText } from '@/ui/Skeleton';
import { useNavigate } from '@/ui/navigation/useNavigate';

/** Как часто перечитывать день (кроме живых событий режима api) */
const REFRESH_MS = 15000;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function DeskScreen() {
  const t = useT('journal');
  const nav = useNavigate();
  const { ready, businessId, businessIds, locationId, staffId: ownStaffId } = useCurrent();
  const activeBusinessIds = locationId === 'all' ? businessIds : businessId ? [businessId] : [];
  const idsKey = activeBusinessIds.join(',');
  const scope = useJournalStaffScope();
  const rights = useJournalBlockRights();
  const canArrive = useCan('journal.edit');
  const hourCycle = useJournalHourFormat();
  const format = useFormat({ hourCycle });
  const date = useTodayYerevan();
  const nowMin = useNowMinuteYerevan(date);
  const api = useDayListActions();
  const [staffFilter, setStaffFilter] = useState<Id | 'all'>('all');

  const bookingsQ = useApiQuery(['journal', 'bookings', idsKey, date], () => listBookings({ businessIds: activeBusinessIds, from: date, to: date }), {
    enabled: ready && activeBusinessIds.length > 0,
  });
  const clientsQ = useApiQuery(['journal', 'clients', businessId], () => coreList('clients', { businessId: businessId! }), {
    enabled: ready && Boolean(businessId),
  });
  const staffQ = useApiQuery(['journal', 'desk-staff', idsKey], () => coreList('staff', (s) => activeBusinessIds.includes(s.businessId)), {
    enabled: ready && activeBusinessIds.length > 0,
  });
  const servicesQ = useApiQuery(['journal', 'desk-services', idsKey], () => coreList('services', (s) => activeBusinessIds.includes(s.businessId)), {
    enabled: ready && activeBusinessIds.length > 0,
  });

  // Само обновляется: день перечитывается раз в 15 с (данные «извне» — опрос, а не запись, CONVENTIONS §18.2)
  const refetchBookings = bookingsQ.refetch;
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => void refetchBookings(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [ready, refetchBookings]);

  const loading = !ready || bookingsQ.isLoading || clientsQ.isLoading || staffQ.isLoading || scope.ready === false || nowMin === null;
  const isError = bookingsQ.isError || clientsQ.isError || staffQ.isError;

  const clientsById = new Map((clientsQ.data ?? []).map((c) => [c.id, c]));
  const staffById = new Map((staffQ.data ?? []).map((s) => [s.id, s]));
  const servicesById = new Map<string, Service>((servicesQ.data ?? []).map((s) => [s.id, s]));
  const visible: Booking[] = (bookingsQ.data ?? []).filter((b) => !scope.ownOnlyStaffId || b.staffId === scope.ownOnlyStaffId);
  // Мастера с визитами сегодня — для фильтра (видит всех — фильтр нужен; только свои — нет)
  const dayStaffIds = [...new Set(visible.filter((b) => !b.deletedAt && !b.groupEventId).map((b) => b.staffId))];
  const filterStaff = staffFilter !== 'all' && dayStaffIds.includes(staffFilter) ? [staffFilter] : undefined;
  const groups = deskGroups(visible, nowMin ?? 0, filterStaff);
  const upcomingCount = groups.late.length + groups.soon.length + groups.later.length;
  const { pageItems: laterPage, pager: laterPager } = usePagedList(groups.later, { resetKey: staffFilter });

  const openBooking = (id: Id) => nav.go(`/biz/journal?booking=${id}&date=${date}`);
  const startOf = (b: Booking) => Number(b.start.slice(11, 13)) * 60 + Number(b.start.slice(14, 16));

  const card = (b: Booking, tone: DeskCardTone) => (
    <DeskVisitCard
      key={b.id}
      booking={b}
      tone={tone}
      client={b.clientId ? clientsById.get(b.clientId) : undefined}
      staff={staffById.get(b.staffId)}
      servicesById={servicesById}
      minutesToStart={startOf(b) - (nowMin ?? 0)}
      showPhone={rights.showPhones}
      canArrive={canArrive}
      api={api}
      onOpen={() => openBooking(b.id)}
      hourCycle={hourCycle}
    />
  );

  const section = (key: string, title: string, list: Booking[], tone: DeskCardTone, after?: ReactNode) =>
    list.length > 0 && (
      <section aria-labelledby={`desk-${key}`} className="flex flex-col gap-3">
        <h2 id={`desk-${key}`} className={cn('flex items-baseline gap-2 text-lg font-semibold', tone === 'late' ? 'text-danger' : 'text-fg')}>
          {title}
          <span className="text-base font-medium text-muted tabular-nums">{list.length}</span>
        </h2>
        <ul className="grid gap-3 xl:grid-cols-2">{list.map((b) => card(b, tone))}</ul>
        {after}
      </section>
    );

  const nowLabel = nowMin === null ? '' : format.time(`${date}T${String(Math.floor(nowMin / 60)).padStart(2, '0')}:${String(nowMin % 60).padStart(2, '0')}`);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        back={{ href: '/biz/journal', label: t('desk.back') }}
        title={t('desk.title')}
        description={t('desk.subtitle')}
        meta={
          <span className="inline-flex items-center gap-2 text-sm text-muted">
            <CalendarDays aria-hidden className="size-4" />
            <span className="font-semibold text-fg">{capitalize(format.date(date, 'weekdayShort'))}</span>
            <span aria-hidden>·</span>
            <span className="font-semibold text-fg tabular-nums">{loading ? <SkeletonText width="5ch" /> : nowLabel}</span>
            <span aria-hidden>·</span>
            {t('desk.autoRefresh')}
            <IconButton
              variant="ghost"
              size="sm"
              icon={<RefreshCw aria-hidden className={cn(bookingsQ.isFetching && !bookingsQ.isLoading && 'motion-safe:animate-spin')} />}
              label={t('desk.refresh')}
              onClick={() => void bookingsQ.refetch()}
              className="-my-2"
            />
          </span>
        }
      />

      {/* Три числа — «что происходит» за секунду */}
      <div className="grid grid-cols-3 gap-3">
        <DeskCount icon={<Clock3 aria-hidden />} tone="danger" label={t('desk.count.late')} value={groups.late.length} loading={loading} />
        <DeskCount icon={<UsersRound aria-hidden />} tone="primary" label={t('desk.count.upcoming')} value={upcomingCount} loading={loading} />
        <DeskCount icon={<UserCheck aria-hidden />} tone="success" label={t('desk.count.arrived')} value={groups.arrivedCount} loading={loading} />
      </div>

      {/* Пока грузится — те же чипы серыми (у кого видно всех мастеров, ряд почти всегда есть) */}
      {!scope.ownOnlyStaffId && loading && (
        <ScrollRow gap="sm" bleed arrows={false} aria-hidden>
          <Chip selected>{t('desk.allMasters')}</Chip>
          {[13, 11, 14, 12].map((w, i) => (
            <Chip key={i} disabled icon={<span className="-ml-1 block size-6 rounded-full bg-surface-3" />}>
              <SkeletonText width={`${w}ch`} />
            </Chip>
          ))}
        </ScrollRow>
      )}
      {!scope.ownOnlyStaffId && dayStaffIds.length > 1 && !loading && (
        <ScrollRow gap="sm" bleed aria-label={t('desk.mastersLabel')}>
          <Chip selected={staffFilter === 'all'} onClick={() => setStaffFilter('all')}>
            {t('desk.allMasters')}
          </Chip>
          {dayStaffIds.map((id) => {
            const s = staffById.get(id);
            if (!s) return null;
            return (
              <Chip
                key={id}
                selected={staffFilter === id}
                onClick={() => setStaffFilter(staffFilter === id ? 'all' : id)}
                icon={<Avatar name={s.name} src={s.photos[0]} colorIndex={s.colorIndex} size="xs" className="-ml-1" />}
              >
                {s.name}
              </Chip>
            );
          })}
        </ScrollRow>
      )}

      {isError && !loading ? (
        <ErrorState onRetry={() => void bookingsQ.refetch()} />
      ) : loading ? (
        <section className="flex flex-col gap-3" aria-busy>
          <h2 className="text-lg font-semibold">
            <SkeletonText width="16ch" />
          </h2>
          <ul className="grid gap-3 xl:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <DeskVisitCardSkeleton key={i} />
            ))}
          </ul>
        </section>
      ) : (
        <>
          {section('late', t('desk.groups.late'), groups.late, 'late')}
          {section('soon', t('desk.groups.soon'), groups.soon, 'soon')}
          {groups.later.length > 0 && (
            <section aria-labelledby="desk-later" className="flex flex-col gap-3">
              <h2 id="desk-later" className="flex items-baseline gap-2 text-lg font-semibold text-fg">
                {t('desk.groups.later')}
                <span className="text-base font-medium text-muted tabular-nums">{groups.later.length}</span>
              </h2>
              <ul className="grid gap-3 xl:grid-cols-2">{laterPage.map((b) => card(b, 'later'))}</ul>
              {laterPager}
            </section>
          )}
          {upcomingCount === 0 && (
            <EmptyState
              variant="section"
              framed
              icon={<UserCheck />}
              title={t('desk.emptyTitle')}
              description={t('desk.emptyText')}
              action={
                <LinkButton href="/biz/journal" variant="secondary">
                  {t('desk.back')}
                </LinkButton>
              }
            />
          )}
          {section('in-salon', t('desk.groups.inSalon'), groups.inSalon, 'inSalon')}
        </>
      )}

      <ForeignChangeHighlight businessIds={activeBusinessIds} onlyStaffId={scope.ownOnlyStaffId} ownStaffId={ownStaffId} enabled={ready} />
      <span className="sr-only" aria-live="polite">
        {loading ? '' : t('desk.liveSummary', { late: groups.late.length, upcoming: upcomingCount })}
      </span>
    </div>
  );
}

function DeskCount({ icon, label, value, tone, loading }: { icon: ReactNode; label: string; value: number; tone: 'danger' | 'primary' | 'success'; loading: boolean }) {
  const toneClass = { danger: 'bg-danger-soft text-danger', primary: 'bg-primary-soft text-primary-text', success: 'bg-success-soft text-success' }[tone];
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:gap-3 sm:p-4">
      <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-xl [&_svg]:size-[18px]', toneClass)}>{icon}</span>
      <span className="flex min-w-0 flex-col">
        <span className={cn('text-2xl leading-7 font-bold tabular-nums', tone === 'danger' && value > 0 ? 'text-danger' : 'text-fg')}>
          {loading ? <SkeletonText width="2ch" /> : value}
        </span>
        <span className="text-sm leading-tight text-muted">{label}</span>
      </span>
    </div>
  );
}
