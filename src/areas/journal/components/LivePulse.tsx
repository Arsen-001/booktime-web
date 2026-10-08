'use client';

/**
 * «Пульс дня» над сеткой в стиле «Живой день» (owner 08.10.2026, lib/journalStyle) — вместо строки итогов: выручка
 * сделанного из плана дня с полосой, сколько мастеров сейчас с клиентом, свободные окна от часа, ждут ответа,
 * опаздывают. Сделанное — записи, которые уже закончились или идут с отметкой «Пришёл»; день в прошлом — весь план.
 */
import type { Booking, DayHours, Id, ISODate, Staff } from '@/domain/core';
import { computeWaitlistStatus, useWaitlist, waitlistWantsDay } from '@/api/resources';
import type { DayTotalsData } from '@/areas/journal/lib/board';
import { FREE_SLOT_MIN, freeGaps, isActiveBooking, startMinutes } from '@/areas/journal/lib/board';
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
  /** Мастера с графиком в этот день и их часы — свободные окна от часа (сегодня — от «сейчас») */
  staff: Staff[];
  hoursByStaff: Record<Id, DayHours>;
  businessId?: Id;
  onPendingClick: () => void;
  className?: string;
}

export function LivePulse({ date, bookings, totals, staff, hoursByStaff, businessId, onPendingClick, className }: LivePulseProps) {
  const staffCount = staff.length;
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
  // Свободные окна от часа, как на сетке: сегодня — от «сейчас», впереди — весь день, прошлый день — нет
  const gaps = dayPast
    ? []
    : staff.flatMap((s) =>
        freeGaps(hoursByStaff[s.id] ?? [], bookings.filter((b) => b.staffId === s.id), FREE_SLOT_MIN, nowMin !== null ? Math.ceil(nowMin / 5) * 5 : 0),
      );
  const freeMin = gaps.reduce((sum, g) => sum + g.to - g.from, 0);
  // Лист ожидания на этот день: активные заявки, которые ждут этот день или любой
  const waitlistQuery = useWaitlist(businessId, { enabled: Boolean(businessId) && !dayPast });
  const waiting = dayPast
    ? 0
    : (waitlistQuery.data ?? []).filter((e) => computeWaitlistStatus(e, today()) === 'active' && waitlistWantsDay(e, date)).length;

  return (
    <section
      aria-label={t('board.live.pulse')}
      className={cn('flex min-h-[52px] flex-wrap items-center gap-x-6 gap-y-1 rounded-[14px] border border-border bg-surface px-5 py-2 text-[13px] text-muted', className)}
    >
      {showStatistics && (
        <span className="flex items-center gap-2.5 whitespace-nowrap">
          {t('board.live.revenue')} <b className="font-bold text-fg tabular-nums">{format.money(done)}</b> {t('board.live.revenueOf', { total: format.money(totals.revenue) })}
          <span aria-hidden className="block h-2 w-36 overflow-hidden rounded-full bg-surface-3">
            <span className="block h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${pct}%` }} />
          </span>
        </span>
      )}
      {busy > 0 && <span className="whitespace-nowrap">{t('board.live.busyNow', { n: busy, total: staffCount })}</span>}
      {gaps.length > 0 && (
        <span className="whitespace-nowrap text-primary-text">
          <b className="font-bold">{t('board.live.freeSlots', { n: gaps.length })}</b> · {format.duration(freeMin)}
        </span>
      )}
      {waiting > 0 && <span className="whitespace-nowrap">{t('board.live.waitlist', { n: waiting })}</span>}
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
