'use client';

/**
 * Переход по датам (F-01-009): ‹ › и заголовок «Пятница, 26 сентября · сегодня ⌄» — по нажатию месячный календарь
 * с загрузкой дней (F-01-003, F-01-004) в поповере. Шаг стрелок — день, неделя или месяц по текущему виду.
 * Заголовок не режется на полуслове (29.09.2026: «Вторник, 29 сентя…» на 1440): по месту, которое ряду оставили
 * кнопки справа, показывается целиком самая длинная из форм — «Вторник, 29 сентября» → «Вт, 29 сентября» →
 * «Вт, 29 сент.» → «29 сент.» (меряем настоящую ширину текста — на армянском и английском формы другой длины),
 * а «сегодня» в тесноте (@container) уходит под дату.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Id, ISODate } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { useFormat } from '@/i18n/useFormat';
import { addDays, parse, toISODate, today, weekStart } from '@/lib/date';
import { cn } from '@/lib/cn';
import { MiniCalendarPanel } from '@/areas/journal/components/MiniCalendarPanel';
import { renderedJournalStyle } from '@/areas/journal/lib/journalStyle';
import type { JournalView } from '@/areas/journal/components/JournalToolbar';
import { Button } from '@/ui/Button';
import { DropdownChevron } from '@/ui/DropdownChevron';
import { IconButton } from '@/ui/IconButton';
import { Popover } from '@/ui/Popover';

export interface JournalDateNavProps {
  date: ISODate;
  onDateChange: (date: ISODate) => void;
  view: JournalView;
  /** Мастера, по которым мини-календарь считает загрузку дней */
  staffIds: Id[];
}

/** Сдвиг даты на шаг вида */
export function shiftDate(date: ISODate, view: JournalView, dir: 1 | -1): ISODate {
  if (view === 'week') return addDays(date, 7 * dir);
  if (view === 'month') return toISODate(parse(date).add(dir, 'month'));
  return addDays(date, dir);
}

/** «сегодня» / «завтра» / «вчера» рядом с датой; иначе — ничего */
export function useRelativeDay() {
  const t = useT('journal');
  return (date: ISODate): string | undefined => {
    const now = today();
    if (date === now) return t('board.today');
    if (date === addDays(now, 1)) return t('board.tomorrow');
    if (date === addDays(now, -1)) return t('board.yesterday');
    return undefined;
  };
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function JournalDateNav({ date, onDateChange, view, staffIds }: JournalDateNavProps) {
  const t = useT('journal');
  const format = useFormat();
  const relative = useRelativeDay();
  const weekRange = (style: 'dayMonth' | 'dayMonthShort') =>
    `${format.date(weekStart(date), style)} – ${format.date(addDays(weekStart(date), 6), style)}`;
  // Формы одного заголовка — от полной к самой короткой
  const titles: string[] =
    view === 'month'
      ? [capitalize(format.date(date, 'monthYear'))]
      : view === 'week'
        ? [weekRange('dayMonth'), weekRange('dayMonthShort')]
        : [
            capitalize(format.date(date, 'weekdayLong')),
            capitalize(format.date(date, 'weekday')),
            capitalize(format.date(date, 'weekdayShort')),
            format.date(date, 'dayMonthShort'),
          ];
  const rel = view === 'day' ? relative(date) : undefined;
  const style = renderedJournalStyle();
  const google = style === 'google';
  const ios = style === 'ios';
  const titleClass = google
    ? 'text-[22px] leading-tight font-normal text-fg'
    : ios
      ? 'text-[26px] leading-tight font-bold tracking-[-0.4px] text-fg'
      : // BookTime («Живой день»): Manrope 26/800, как в макете
        'font-display text-[26px] leading-tight font-extrabold tracking-[-0.5px] text-fg';

  // Какая форма влезает: место под кнопку (slot) минус всё, что в кнопке кроме текста, сравниваем с шириной форм
  const slotRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(0);
  const titlesKey = titles.join('|');
  useEffect(() => {
    const slot = slotRef.current;
    const measure = measureRef.current;
    if (!slot || !measure) return;
    const update = () => {
      const button = slot.querySelector('button');
      const title = titleRef.current;
      if (!button || !title) return;
      const room = slot.clientWidth - (button.offsetWidth - title.offsetWidth);
      const widths = [...measure.children].map((c) => (c as HTMLElement).offsetWidth);
      const i = widths.findIndex((w) => w <= room);
      const next = i === -1 ? widths.length - 1 : i;
      setFit((prev) => (prev === next ? prev : next));
    };
    update();
    // Шрифт догрузился — ширины форм другие
    void document.fonts?.ready.then(update);
    const ro = new ResizeObserver(update);
    ro.observe(slot);
    return () => ro.disconnect();
    // Новая дата/вид/язык — формы другой длины, меряем заново
  }, [titlesKey]);
  const title = titles[Math.min(fit, titles.length - 1)];

  return (
    // @container: «сегодня» рядом с датой или под ней — по ширине ряда
    <div data-f="F-01-009" className="@container flex min-w-0 flex-1 items-center gap-1">
      {/* Стиль «Google Calendar» (owner 08.10.2026): «Сегодня» — пилюля с рамкой, затем ‹ ›, затем заголовок */}
      {/* «Календарь iOS»: «Сегодня» — красное слово без рамки, стрелки красные */}
      {ios && (
        <Button variant="ghost" className="shrink-0 px-2 text-danger" onClick={() => onDateChange(today())}>
          {t('toolbar.today')}
        </Button>
      )}
      {google && (
        <Button variant="outline" className="mr-2 shrink-0 rounded-full px-5" onClick={() => onDateChange(today())}>
          {t('toolbar.today')}
        </Button>
      )}
      <IconButton variant={google || ios ? 'ghost' : 'outline'} className={google ? 'rounded-full' : ios ? 'text-danger' : undefined} icon={<ChevronLeft aria-hidden />} label={t(`board.prev.${view}`)} onClick={() => onDateChange(shiftDate(date, view, -1))} />
      <IconButton variant={google || ios ? 'ghost' : 'outline'} className={google ? 'rounded-full' : ios ? 'text-danger' : undefined} icon={<ChevronRight aria-hidden />} label={t(`board.next.${view}`)} onClick={() => onDateChange(shiftDate(date, view, 1))} />
      <div ref={slotRef} className="relative ml-2 flex min-w-0 flex-1">
        {/* Невидимые образцы всех форм — по ним меряем, какая влезет */}
        <span ref={measureRef} aria-hidden className="pointer-events-none invisible absolute top-0 left-0 h-0 w-0 overflow-hidden">
          {/* key — номер формы: в en «weekday» и «weekdayShort» совпадают («Thu, Oct 8») */}
          {titles.map((text, i) => (
            <span key={i} className={cn(titleClass, 'block w-max whitespace-nowrap')}>
              {text}
            </span>
          ))}
        </span>
        <Popover
          align="start"
          label={t('board.pickDate')}
          trigger={(p) => (
            <button
              {...p}
              type="button"
              className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span
                className={cn(
                  'flex min-w-0',
                  // BookTime: «сегодня» плашкой в строку с датой, как в макете
                  google || ios ? 'flex-col @min-[28rem]:flex-row @min-[28rem]:items-baseline @min-[28rem]:gap-2' : 'flex-row items-center gap-2.5',
                )}
              >
                {/* truncate — лишь страховка: форма подобрана так, чтобы влезть целиком */}
                <span ref={titleRef} className={cn(titleClass, 'truncate')}>
                  {title}
                </span>
                {rel &&
                  (google || ios ? (
                    <span className="shrink-0 text-xs text-muted @min-[28rem]:text-sm">{rel}</span>
                  ) : (
                    // BookTime: «сегодня» плашкой рядом с датой
                    <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-0.5 text-[13px] font-semibold text-primary-text">{rel}</span>
                  ))}
              </span>
              {(google || ios) && <DropdownChevron open={p['aria-expanded']} className="shrink-0" />}
            </button>
          )}
        >
          {({ close }) => (
            <div className="flex w-[19rem] flex-col gap-2 p-1">
              <MiniCalendarPanel
                value={date}
                onValueChange={(d) => {
                  onDateChange(d);
                  close();
                }}
                staffIds={staffIds}
              />
              {date !== today() && (
                <button
                  type="button"
                  onClick={() => {
                    onDateChange(today());
                    close();
                  }}
                  className={cn('min-h-10 rounded-md text-sm font-semibold text-primary-text transition-colors hover:bg-primary-soft')}
                >
                  {t('board.goToday')}
                </button>
              )}
            </div>
          )}
        </Popover>
      </div>
    </div>
  );
}
