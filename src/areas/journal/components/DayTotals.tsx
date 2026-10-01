'use client';

/**
 * Итоги дня под рядом управления (DESIGN.md → Journal A2): «15 записей · 142 000 ֏ выручка · 7 свободных окон ·
 * 3 ждут подтверждения» (последнее — цветом warning и кнопкой к панели «Требует внимания»). Считается из данных дня
 * (lib/board.dayTotals), без своих запросов.
 */
import type { DayTotalsData } from '@/areas/journal/lib/board';
import { useJournalBlockRights } from '@/areas/journal/lib/rights';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { cn } from '@/lib/cn';
import { SkeletonText } from '@/ui/Skeleton';

export interface DayTotalsProps {
  totals: DayTotalsData;
  onPendingClick?: () => void;
  className?: string;
}

export function DayTotals({ totals, onPendingClick, className }: DayTotalsProps) {
  const t = useT('journal');
  const format = useFormat();
  // F-01-178 «Показывать статистику»: без права — выручки дня не видно (qa/full-test-0930/journal-perms.md)
  const { showStatistics } = useJournalBlockRights();
  const item = (value: string, label: string) => (
    <span className="whitespace-nowrap">
      <b className="font-bold text-fg tabular-nums">{value}</b> {label}
    </span>
  );
  return (
    <p aria-label={t('board.totals.label')} className={cn('flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-muted', className)}>
      {item(format.number(totals.bookings), t('board.totals.bookings', { n: totals.bookings }))}
      {showStatistics && item(format.money(totals.revenue), t('board.totals.revenue'))}
      {item(format.number(totals.freeSlots), t('board.totals.free', { n: totals.freeSlots }))}
      {totals.pending > 0 && (
        <button
          type="button"
          onClick={onPendingClick}
          className="-mx-1 rounded-md px-1 whitespace-nowrap text-warning transition-colors hover:bg-warning-soft focus-visible:outline-2 focus-visible:outline-focus"
        >
          <b className="font-bold tabular-nums">{format.number(totals.pending)}</b> {t('board.totals.pending', { n: totals.pending })}
        </button>
      )}
    </p>
  );
}

/** Итоги при первой загрузке — та же строка, числа и подписи полосами (DESIGN.md → «The skeleton IS the page») */
export function DayTotalsSkeleton({ className }: { className?: string }) {
  const t = useT('journal');
  return (
    <p aria-label={t('board.totals.label')} className={cn('flex flex-wrap items-center gap-x-6 gap-y-1 text-[13px] text-muted', className)}>
      {['9ch', '16ch', '15ch', '19ch'].map((w) => (
        <span key={w} className="whitespace-nowrap">
          <SkeletonText width={w} />
        </span>
      ))}
    </p>
  );
}
