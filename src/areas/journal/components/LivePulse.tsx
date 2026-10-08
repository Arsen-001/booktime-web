'use client';

/**
 * «Пульс дня» над сеткой в стиле «Живой день» (owner 08.10.2026, lib/journalStyle) — вместо строки итогов: выручка
 * сделанного из плана дня с полосой, сколько мастеров сейчас с клиентом, свободные окна от часа, ждут ответа,
 * опаздывают. Сделанное — записи, которые уже закончились или идут с отметкой «Пришёл»; день в прошлом — весь план.
 */
import type { Booking, ISODate } from '@/domain/core';
import type { DayTotalsData } from '@/areas/journal/lib/board';
import { isActiveBooking, startMinutes } from '@/areas/journal/lib/board';
import { lateMinutes, useNowMinuteYerevan } from '@/areas/journal/lib/lateness';
import { useJournalBlockRights } from '@/areas/journal/lib/rights';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';

export interface LivePulseProps {
  date: ISODate;
  bookings: Booking[];
  totals: DayTotalsData;
  /** Сколько мастеров с графиком в этот день */
  staffCount: number;
  onPendingClick: () => void;
  className?: string;
}

export function LivePulse({ date, bookings, totals, staffCount, onPendingClick, className }: LivePulseProps) {
  const t = useT('journal');
  const format = useFormat();
  const { showStatistics } = useJournalBlockRights();
  const nowMin = useNowMinuteYerevan(date);
  const active = bookings.filter((b) => isActiveBooking(b) && b.status !== 'no_show');
  const dayPast = date < today();
  const done = dayPast
    ? totals.revenue
    : nowMin === null
      ? 0
      : active
          .filter((b) => startMinutes(b) + b.durationMin <= nowMin || (b.status === 'arrived' && startMinutes(b) <= nowMin))
          .reduce((sum, b) => sum + b.total, 0);
  const busy =
    nowMin === null
      ? 0
      : new Set(active.filter((b) => startMinutes(b) <= nowMin && nowMin < startMinutes(b) + b.durationMin && lateMinutes(b, nowMin) === null).map((b) => b.staffId)).size;
  const late = nowMin === null ? 0 : bookings.filter((b) => lateMinutes(b, nowMin) !== null).length;
  const pct = totals.revenue > 0 ? Math.round((done / totals.revenue) * 100) : 0;

  return (
    <section
      aria-label={t('board.live.pulse')}
      className={cn('flex min-h-[52px] flex-wrap items-center gap-x-7 gap-y-1 rounded-2xl border border-border bg-surface px-5 py-2 text-[13px] text-muted', className)}
    >
      {showStatistics && (
        <span className="flex items-center gap-2.5 whitespace-nowrap">
          {t('board.live.revenue')} <b className="font-bold text-fg tabular-nums">{format.money(done)}</b> {t('board.live.revenueOf', { total: format.money(totals.revenue) })}
          <span aria-hidden className="block h-2 w-40 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </span>
        </span>
      )}
      {busy > 0 && <span className="whitespace-nowrap">{t('board.live.busyNow', { n: busy, total: staffCount })}</span>}
      <span className="font-semibold whitespace-nowrap text-primary-text">{t('board.live.freeSlots', { n: totals.freeSlots })}</span>
      {totals.pending > 0 && (
        <button
          type="button"
          onClick={onPendingClick}
          className="-mx-1 rounded-md px-1 whitespace-nowrap text-warning transition-colors hover:bg-warning-soft focus-visible:outline-2 focus-visible:outline-focus"
        >
          {t('board.live.pending', { n: totals.pending })}
        </button>
      )}
      {late > 0 && <span className="ml-auto font-semibold whitespace-nowrap text-danger">{t('board.live.late_n', { n: late })}</span>}
    </section>
  );
}
