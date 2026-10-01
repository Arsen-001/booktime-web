'use client';

import { ChevronRight, House } from 'lucide-react';
import type { CalendarDay } from '@/api/schedule';
import { dayTypeById } from '@/domain/schedule';
import { dayBreaks } from '@/domain/rules';
import { spanText } from '@/areas/schedule/lib/hours';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { cn } from '@/lib/cn';
import { today } from '@/lib/date';
import { Badge } from '@/ui/Badge';

export interface CalendarDayRowProps {
  day: CalendarDay;
  mode: 'free' | 'busy' | undefined;
  onOpen: () => void;
}

/**
 * Одна строка недели «Моего календаря» (ux-r5 №3, speed-k1 №1): «пн, 21 сент · 10:00–19:00 · перерыв 14–15 ·
 * [занято 13–14]». Вместо стены из ~40 полей — компактный список; правка дня — в шторке по нажатию.
 */
export function CalendarDayRow({ day, mode, onOpen }: CalendarDayRowProps) {
  const t = useT('schedule');
  const tDyn = useTDynamic();
  const format = useFormat();
  const now = today();
  const isToday = day.date === now;
  const past = day.date < now;
  const dt = day.typeId ? dayTypeById(day.typeId) : null;
  const works = day.hours.length > 0 && dt?.id !== 'not_working' && dt?.working !== false;
  const breaks = works ? dayBreaks(day.hours) : [];
  // Г18: не «Выходной · Дома 11–16» (выходной и работа сразу), а «В салоне не работает · Дома 11–16»
  const offLabel =
    dt && !dt.working && dt.id !== 'not_working'
      ? tDyn(`schedule.${dt.labelKey}`)
      : day.elsewhere?.length
        ? t('calendar.notInSalon')
        : t('calendar.dayOff');
  const marks = day.marks.filter((m) => (mode === 'busy' ? m.kind === 'free' : m.kind === 'busy'));

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={isToday ? 'date' : undefined}
      className={cn(
        'flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        isToday ? 'border-primary/40 bg-primary-soft' : 'border-border bg-surface hover:bg-surface-2',
        past && !isToday && 'opacity-70',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-fg first-letter:uppercase">{format.date(day.date, 'weekday')}</span>
          {isToday && <Badge tone="primary">{t('calendar.today')}</Badge>}
          {day.bookings > 0 && <span className="text-sm text-muted">{t('calendar.bookingsCount', { n: day.bookings })}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {works ? (
            <span className="font-medium text-fg tabular-nums">{spanText(day.hours)}</span>
          ) : (
            <span className="text-muted">{offLabel}</span>
          )}
          {breaks.map((b) => (
            <span key={b.from} className="text-muted">
              · {t('calendar.breakShort', { from: b.from, to: b.to })}
            </span>
          ))}
          {day.elsewhere?.map((e) => (
            <span key={e.workplace} className="inline-flex items-center gap-1 text-info">
              <House className="size-3.5" aria-hidden />
              {t(`table.workplace.${e.workplace}` as 'table.workplace.home')} {spanText(e.hours)}
            </span>
          ))}
        </div>
        {day.note && <p className="text-sm text-info">{day.note}</p>}
        {marks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {marks.map((m) => (
              <Badge key={m.id} tone={m.kind === 'free' ? 'success' : 'warning'}>
                {m.kind === 'free'
                  ? t('calendar.openRange', { from: m.from, to: m.to })
                  : t('calendar.busyRange', { from: m.from, to: m.to })}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </button>
  );
}
