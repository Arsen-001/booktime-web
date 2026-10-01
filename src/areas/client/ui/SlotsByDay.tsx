'use client';

import type { FreeSlot } from '@/api/schedule';
import { useClientFormat } from '@/areas/client/useClientFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { SlotButton, type SlotButtonSize } from '@/ui/SlotButton';
import { ScrollRow } from '@/ui/ScrollRow';
import { SlotRow } from '@/ui/SlotRow';

export interface SlotsByDayProps {
  slots: FreeSlot[];
  /** Куда ведёт окно (каталог, карточка мастера — сразу в запись) */
  hrefFor?: (slot: FreeSlot) => string;
  /** Выбор окна на месте (поток записи, перенос) */
  onSelect?: (slot: FreeSlot) => void;
  selected?: string;
  /** Подписывать место окна («дома у мастера», «выезд») — когда у мастера их несколько (F-00-073) */
  showWorkplace?: boolean;
  size?: SlotButtonSize;
  bleed?: boolean;
  /**
   * Все дни одним рядом («Сегодня 10:00 16:30 · Сб, 3 октября 10:45»), а не ряд на день: высота карточки не зависит
   * от того, на сколько дней пришлись окна (каталог — скелетон карточки совпадает с ней, DESIGN.md «The skeleton IS the page»)
   */
  singleRow?: boolean;
  className?: string;
}

/**
 * Ближайшие окна по дням: подпись дня один раз, время — кнопками в ряд без переноса (ux-r1 №3, ux-r5 улучшение 1).
 * У окна «дома у мастера» или «выезд» подпись места в названии ряда — клиент видит, где окно (F-00-073, decision-c3 №2).
 */
export function SlotsByDay({
  slots,
  hrefFor,
  onSelect,
  selected,
  showWorkplace = false,
  size = 'sm',
  bleed = false,
  singleRow = false,
  className,
}: SlotsByDayProps) {
  const fmt = useClientFormat();
  const tc = useT('common');
  const groups: { key: string; date: string; workplace: FreeSlot['workplace']; slots: FreeSlot[] }[] = [];
  for (const s of slots) {
    const date = s.start.slice(0, 10);
    const key = showWorkplace ? `${date}|${s.workplace}` : date;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.slots.push(s);
    else groups.push({ key, date, workplace: s.workplace, slots: [s] });
  }
  const labelOf = (g: (typeof groups)[number]) => {
    const day = fmt.relativeDay(g.date);
    return showWorkplace && g.workplace !== 'salon' ? `${day} · ${tc(`workplace.${g.workplace}`).toLowerCase()}` : day;
  };
  const button = (s: FreeSlot) => (
    <SlotButton
      key={`${s.locationId}-${s.start}`}
      size={size}
      href={hrefFor?.(s)}
      selected={selected === s.start}
      onClick={onSelect ? () => onSelect(s) : undefined}
    >
      {fmt.time(s.start)}
    </SlotButton>
  );
  if (singleRow) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <ScrollRow bleed={bleed} className="w-full">
          {groups.flatMap((g, i) => [
            <span
              key={`label-${g.key}`}
              className={cn('inline-block pr-1 text-sm font-medium whitespace-nowrap text-muted first-letter:uppercase', i > 0 && 'pl-2')}
            >
              {labelOf(g)}
            </span>,
            ...g.slots.map(button),
          ])}
        </ScrollRow>
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {groups.map((g) => {
        const day = fmt.relativeDay(g.date);
        const label = showWorkplace && g.workplace !== 'salon' ? `${day} · ${tc(`workplace.${g.workplace}`).toLowerCase()}` : day;
        return (
          <SlotRow key={g.key} label={label} bleed={bleed}>
            {g.slots.map((s) => (
              <SlotButton
                key={`${s.locationId}-${s.start}`}
                size={size}
                href={hrefFor?.(s)}
                selected={selected === s.start}
                onClick={onSelect ? () => onSelect(s) : undefined}
              >
                {fmt.time(s.start)}
              </SlotButton>
            ))}
          </SlotRow>
        );
      })}
    </div>
  );
}
