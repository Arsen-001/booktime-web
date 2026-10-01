'use client';

/**
 * Вид «Месяц» (DESIGN.md → Journal A2: День / Неделя / Месяц): сетка месяца, в дне — число записей и полоса загрузки
 * мастеров (та же загрузка, что у мини-календаря, F-01-003/F-01-004). Нажатие на день открывает этот день.
 */
import type { Id, ISODate } from '@/domain/core';
import { listBookings } from '@/api/core';
import { getRangeLoad } from '@/api/journal';
import { useApiQuery } from '@/api/request';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { cn } from '@/lib/cn';
import { addDays, eachDay, parse, toISODate, today, weekStart } from '@/lib/date';
import { isActiveBooking } from '@/areas/journal/lib/board';
import { ErrorState } from '@/ui/ErrorState';
import { Skeleton } from '@/ui/Skeleton';

export interface MonthGridProps {
  date: ISODate;
  staffIds: Id[];
  businessIds: Id[];
  onPickDay: (date: ISODate) => void;
}

export function MonthGrid({ date, staffIds, businessIds, onPickDay }: MonthGridProps) {
  const t = useT('journal');
  const format = useFormat();
  const monthStart = toISODate(parse(date).startOf('month'));
  const from = weekStart(monthStart);
  const to = addDays(from, 41);
  const days = eachDay(from, to);
  const month = monthStart.slice(0, 7);

  const loadQuery = useApiQuery(['journal', 'range-load', staffIds.join(','), from, to], () => getRangeLoad(staffIds, from, to), {
    enabled: staffIds.length > 0,
  });
  const bookingsQuery = useApiQuery(['journal', 'month-bookings', businessIds.join(','), from, to], () => listBookings({ businessIds, from, to }), {
    enabled: businessIds.length > 0,
  });

  if (loadQuery.isError || bookingsQuery.isError)
    return (
      <ErrorState
        onRetry={() => {
          loadQuery.refetch();
          bookingsQuery.refetch();
        }}
      />
    );
  if (bookingsQuery.isLoading || (staffIds.length > 0 && loadQuery.isLoading))
    return <Skeleton variant="rect" className="h-96 w-full rounded-2xl" />;

  const counts: Record<ISODate, number> = {};
  for (const b of bookingsQuery.data ?? []) {
    if (!isActiveBooking(b) || !staffIds.includes(b.staffId)) continue;
    const d = b.start.slice(0, 10);
    counts[d] = (counts[d] ?? 0) + 1;
  }
  const weekdays = format.weekdaysShort();
  const now = today();

  return (
    <div data-f="F-01-003 F-01-004" className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-border bg-surface">
      <div className="sticky top-0 z-10 grid grid-cols-7 border-b border-border bg-surface">
        {weekdays.map((w) => (
          <span key={w} className="py-3 text-center text-xs font-semibold text-muted capitalize">
            {w}
          </span>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((d) => {
          const load = loadQuery.data?.[d];
          const count = counts[d] ?? 0;
          const inMonth = d.startsWith(month);
          const pct = Math.round((load?.ratio ?? 0) * 100);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onPickDay(d)}
              aria-label={`${format.date(d, 'weekdayLong')}: ${t('board.month.bookings', { n: count })}`}
              className={cn(
                'flex min-h-20 flex-col items-start gap-1 border-t border-l border-line p-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                !inMonth && 'text-muted opacity-60',
              )}
            >
              <span
                className={cn(
                  'grid size-7 place-items-center rounded-full text-sm font-semibold tabular-nums',
                  d === now ? 'bg-primary text-primary-contrast' : d === date ? 'bg-primary-soft text-primary-text' : 'text-fg',
                )}
              >
                {Number(d.slice(8, 10))}
              </span>
              {load && !load.hasSchedule ? (
                <span className="text-[11px] text-muted">{t('board.month.dayOff')}</span>
              ) : (
                <>
                  <span className="text-xs text-fg">{count > 0 ? t('board.month.bookings', { n: count }) : <span className="text-muted">{t('board.month.empty')}</span>}</span>
                  <span aria-hidden className="mt-auto h-1 w-full overflow-hidden rounded-full bg-surface-3">
                    <span
                      className={cn('block h-full rounded-full', pct > 80 ? 'bg-danger' : pct > 50 ? 'bg-warning' : 'bg-success')}
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
