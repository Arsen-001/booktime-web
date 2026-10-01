'use client';

/**
 * «Лента изменений» журнала (⭐ рабочий день №12): кто, что и когда изменил за день — новые записи, переносы, статусы,
 * отмены, оплаты. Открывается из «⋯ Ещё». Строка открывает запись (кроме удалённой). Данные — listDayFeed
 * (src/api/journal-feed.ts): мастер без права видеть чужие получает только свои записи.
 */
import { useState } from 'react';
import { ArrowRightLeft, CalendarPlus, CalendarX2, CircleCheck, Clock3, History, Trash2, Undo2, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { listDayFeed, type DayFeedItem, type DayFeedKind } from '@/api/journal-feed';
import { useApiQuery } from '@/api/request';
import { useJournalHourFormat } from '@/areas/journal/lib/useJournalHourFormat';
import type { BookingStatus, Id, ISODate } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { BOOKING_STATUS_META, useBookingStatusLabel } from '@/ui/BookingStatusBadge';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { ErrorState } from '@/ui/ErrorState';
import { usePagedList } from '@/ui/Pagination';
import { ScrollRow } from '@/ui/ScrollRow';
import { Sheet } from '@/ui/Sheet';
import { SkeletonText } from '@/ui/Skeleton';

export type FeedFilter = 'all' | 'created' | 'moved' | 'status' | 'cancelled' | 'payments';
const FILTERS: FeedFilter[] = ['all', 'created', 'moved', 'status', 'cancelled', 'payments'];

const FILTER_OF: Record<DayFeedKind, FeedFilter> = {
  created: 'created',
  moved: 'moved',
  status: 'status',
  delayed: 'status',
  cancelled: 'cancelled',
  deleted: 'cancelled',
  payment: 'payments',
  paymentCancelled: 'payments',
};

const KIND_LOOK: Record<DayFeedKind, { icon: LucideIcon; tone: string }> = {
  created: { icon: CalendarPlus, tone: 'bg-success-soft text-success' },
  moved: { icon: ArrowRightLeft, tone: 'bg-info-soft text-info' },
  status: { icon: CircleCheck, tone: 'bg-primary-soft text-primary-text' },
  delayed: { icon: Clock3, tone: 'bg-warning-soft text-warning' },
  cancelled: { icon: CalendarX2, tone: 'bg-danger-soft text-danger' },
  deleted: { icon: Trash2, tone: 'bg-danger-soft text-danger' },
  payment: { icon: Wallet, tone: 'bg-success-soft text-success' },
  paymentCancelled: { icon: Undo2, tone: 'bg-warning-soft text-warning' },
};

/** Ключ ленты — один на приложение: подсветка чужих правок (useForeignChanges) читает тот же кэш */
export const dayFeedKey = (businessIds: Id[], date: ISODate, onlyStaffId?: Id) =>
  ['journal', 'day-feed', businessIds.join(','), date, onlyStaffId ?? ''] as const;

export interface DayFeedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessIds: Id[];
  date: ISODate;
  onlyStaffId?: Id;
  /** Свой id — строки «Вы» */
  ownStaffId?: Id;
  onOpenBooking: (bookingId: Id, start?: string) => void;
}

export function DayFeedSheet({ open, onOpenChange, businessIds, date, onlyStaffId, ownStaffId, onOpenBooking }: DayFeedSheetProps) {
  const t = useT('journal');
  const format = useFormat();
  const [filter, setFilter] = useState<FeedFilter>('all');
  const q = useApiQuery(dayFeedKey(businessIds, date, onlyStaffId), () => listDayFeed({ businessIds, date, onlyStaffId }), {
    enabled: open && businessIds.length > 0,
  });
  const items = q.data ?? [];
  const counts: Record<FeedFilter, number> = { all: items.length, created: 0, moved: 0, status: 0, cancelled: 0, payments: 0 };
  for (const i of items) counts[FILTER_OF[i.kind]] += 1;
  const shown = filter === 'all' ? items : items.filter((i) => FILTER_OF[i.kind] === filter);
  const { pageItems, pager } = usePagedList(shown, { resetKey: `${filter}:${date}` });
  const loading = q.isLoading || (!q.data && !q.isError);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('feed.title')}
      description={t('feed.description', { day: format.relativeDay(date) })}
      side="auto"
      size="md"
    >
      <div className="flex flex-col gap-4 pb-4">
        <ScrollRow gap="sm" arrows={false} aria-label={t('feed.filtersLabel')}>
          {FILTERS.map((f) => (
            <Chip key={f} selected={filter === f} onClick={() => setFilter(f)} count={loading ? undefined : counts[f]} countLoading={loading}>
              {t(`feed.filters.${f}`)}
            </Chip>
          ))}
        </ScrollRow>
        {q.isError ? (
          <ErrorState onRetry={q.refetch} />
        ) : loading ? (
          <ul className="flex flex-col">
            {Array.from({ length: 6 }, (_, i) => (
              <FeedRowSkeleton key={i} />
            ))}
          </ul>
        ) : shown.length === 0 ? (
          items.length === 0 ? (
            <EmptyState variant="section" icon={<History />} title={t('feed.emptyTitle')} description={t('feed.emptyText')} />
          ) : (
            <EmptyState
              variant="section"
              kind="search"
              icon={<History />}
              title={t('feed.emptyFilter')}
              onReset={() => setFilter('all')}
            />
          )
        ) : (
          <div className={cn('flex flex-col', q.isPlaceholderData && 'opacity-60')}>
            <ul className="flex flex-col">
              {pageItems.map((item) => (
                <FeedRow
                  key={item.id}
                  item={item}
                  ownStaffId={ownStaffId}
                  onOpen={item.kind === 'deleted' ? undefined : () => onOpenBooking(item.bookingId, item.start)}
                />
              ))}
            </ul>
            {pager}
          </div>
        )}
      </div>
    </Sheet>
  );
}

const ROW = 'flex min-h-16 w-full items-start gap-3 px-1 py-3 text-left';
const ROW_LI = 'border-b border-line last:border-b-0';

function FeedRowSkeleton() {
  return (
    <li className={cn(ROW, ROW_LI)} aria-hidden data-skeleton>
      <span className="size-9 shrink-0 rounded-full bg-surface-3" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold">
          <SkeletonText width="16ch" />
        </span>
        <span className="text-sm">
          <SkeletonText width="24ch" />
        </span>
        <span className="text-xs">
          <SkeletonText width="10ch" />
        </span>
      </span>
    </li>
  );
}

function FeedRow({ item, ownStaffId, onOpen }: { item: DayFeedItem; ownStaffId?: Id; onOpen?: () => void }) {
  const t = useT('journal');
  const format = useFormat({ hourCycle: useJournalHourFormat() });
  const statusLabel = useBookingStatusLabel('business');
  // Сервер знает и служебные статусы (например, «предложено другое время») — их подписи у кабинета нет, строку не ломаем
  const known = (status?: string): status is BookingStatus => Boolean(status && status in BOOKING_STATUS_META);
  const { icon: Icon, tone } = KIND_LOOK[item.kind];
  const visit = item.start ? `${format.relativeDay(item.start)}, ${format.time(item.start)}` : undefined;
  const client = item.clientName ?? t('feed.noClient');

  const title = (() => {
    switch (item.kind) {
      case 'created':
        return t('feed.kind.created');
      case 'moved':
        return t('feed.kind.moved');
      case 'status':
        return known(item.to) ? t('feed.kind.status', { status: statusLabel(item.to) }) : t('feed.kind.statusPlain');
      case 'cancelled':
        return item.late ? t('feed.kind.cancelledLate') : t('feed.kind.cancelled');
      case 'deleted':
        return t('feed.kind.deleted');
      case 'delayed':
        return t('feed.kind.delayed', { min: item.delayMin ?? 0 });
      case 'payment':
        return t('feed.kind.payment', { sum: format.money(item.amount ?? 0) });
      case 'paymentCancelled':
        return t('feed.kind.paymentCancelled', { sum: format.money(item.amount ?? 0) });
    }
  })();

  // Что именно: перенос — «было → стало», статус — прежний, отмена — кто отменил, оплата — способ
  const detail = (() => {
    if (item.kind === 'moved') {
      const parts: string[] = [];
      if (item.prevStart && item.start && item.prevStart !== item.start) {
        parts.push(
          item.prevStart.slice(0, 10) === item.start.slice(0, 10)
            ? `${format.time(item.prevStart)} → ${format.time(item.start)}`
            : `${format.relativeDay(item.prevStart)}, ${format.time(item.prevStart)} → ${visit ?? ''}`,
        );
      }
      if (item.prevStaffName && item.staffName) parts.push(`${item.prevStaffName} → ${item.staffName}`);
      return parts.join(' · ') || visit;
    }
    if (item.kind === 'status' && known(item.from)) return t('feed.wasStatus', { status: statusLabel(item.from) });
    if (item.kind === 'cancelled' && known(item.to)) return statusLabel(item.to);
    if ((item.kind === 'payment' || item.kind === 'paymentCancelled') && item.method) return item.method;
    return undefined;
  })();

  const who =
    item.by === ownStaffId ? t('feed.byYou') : item.by === 'client' ? t('feed.byClient') : item.by === 'system' ? t('feed.bySystem') : (item.byName ?? t('feed.byStaff'));

  const body = (
    <>
      <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4', tone)}>
        <Icon aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-fg">{title}</span>
          <span className="truncate text-fg">{client}</span>
        </span>
        <span className="text-sm text-muted">
          {[visit && item.kind !== 'moved' ? visit : undefined, item.kind !== 'moved' ? item.staffName : undefined, detail]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className="text-xs text-muted">
          <span className="font-medium text-fg">{who}</span> · {format.time(item.at)}
        </span>
      </span>
    </>
  );

  return (
    <li className={ROW_LI}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className={cn(ROW, 'rounded-lg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus')}>
          {body}
        </button>
      ) : (
        <div className={ROW}>{body}</div>
      )}
    </li>
  );
}
