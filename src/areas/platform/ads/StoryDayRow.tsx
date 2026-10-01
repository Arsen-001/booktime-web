'use client';

/** День на доске мест сторис: дата, места клетками (занято / свободно), очередь и цена места сейчас. */
import type { StoryBoard } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Badge } from '@/ui/Badge';

type Day = StoryBoard['days'][number];

export function StoryDayRow({ day }: { day: Day }) {
  const t = useT('platform');
  const fmt = useFormat();
  const shown = day.bookings.filter((b) => b.shown);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span className="w-28 shrink-0 font-medium text-fg first-letter:uppercase sm:w-44">{fmt.relativeDay(day.date)}</span>
      <span className="flex gap-1" aria-label={t('ads.boardTakenAria', { taken: day.taken, total: day.total })}>
        {Array.from({ length: day.total }, (_, i) => (
          <span
            key={i}
            className={cn('size-5 rounded-md', i < day.taken ? 'bg-primary' : 'border border-border-strong bg-surface-2')}
            aria-hidden
          />
        ))}
      </span>
      <span className="text-sm text-muted">{day.taken < day.total ? t('ads.placesFree', { n: day.total - day.taken }) : t('ads.placesFull')}</span>
      {day.queued > 0 && <Badge tone="warning" size="sm">{t('ads.queueCount', { n: day.queued })}</Badge>}
      <span className="ml-auto text-sm font-medium text-fg tabular-nums">{t('ads.coinsPerDay', { n: day.taken < day.total ? day.price : day.queuePrice })}</span>
      {shown.length > 0 && <span className="w-full truncate text-xs text-muted">{shown.map((b) => b.businessName).join(' · ')}</span>}
    </li>
  );
}
