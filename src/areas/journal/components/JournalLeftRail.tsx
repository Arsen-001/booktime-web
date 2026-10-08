'use client';

/**
 * Левая колонка журнала в стиле «Google Calendar» (owner 08.10.2026, lib/journalStyle): большая кнопка «Новая запись»
 * с тенью, календарь месяца всегда на виду, мастера цветными флажками — как «Мои календари» у Google. Только компьютер
 * (≥1280px); сворачивается кнопкой ☰ в ряду управления (useLeftRail). В неделе мастер один — выбор строкой, а не флажком.
 * Должности, наборы мастеров и ресурсы — по-прежнему в выборе мастеров в ряду управления (MastersPicker).
 */
import { useSyncExternalStore } from 'react';
import { Plus } from 'lucide-react';
import type { Id, ISODate, Staff } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { MiniCalendarPanel } from '@/areas/journal/components/MiniCalendarPanel';
import type { JournalView } from '@/areas/journal/components/JournalToolbar';
import { Avatar } from '@/ui/Avatar';
import { Checkbox } from '@/ui/Checkbox';
import { Tooltip } from '@/ui/Tooltip';

/** Флажок цвета мастера (тот же набор chart-1..8, что у полосы загрузки в шапке колонки) */
const STAFF_BOX: Record<number, string> = {
  1: 'border-chart-1 checked:border-chart-1 checked:bg-chart-1 hover:border-chart-1',
  2: 'border-chart-2 checked:border-chart-2 checked:bg-chart-2 hover:border-chart-2',
  3: 'border-chart-3 checked:border-chart-3 checked:bg-chart-3 hover:border-chart-3',
  4: 'border-chart-4 checked:border-chart-4 checked:bg-chart-4 hover:border-chart-4',
  5: 'border-chart-5 checked:border-chart-5 checked:bg-chart-5 hover:border-chart-5',
  6: 'border-chart-6 checked:border-chart-6 checked:bg-chart-6 hover:border-chart-6',
  7: 'border-chart-7 checked:border-chart-7 checked:bg-chart-7 hover:border-chart-7',
  8: 'border-chart-8 checked:border-chart-8 checked:bg-chart-8 hover:border-chart-8',
};

const RAIL_KEY = 'bt-journal-rail';
let railOpen: boolean | null = null;
const listeners = new Set<() => void>();

function readRail(): boolean {
  if (railOpen === null) {
    try {
      railOpen = window.localStorage.getItem(RAIL_KEY) !== '0';
    } catch {
      railOpen = true;
    }
  }
  return railOpen;
}

/** Открыта ли левая колонка (запоминается на устройстве) и переключатель для ☰ */
export function useLeftRail(): [boolean, () => void] {
  const open = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readRail,
    () => true,
  );
  const toggle = () => {
    railOpen = !readRail();
    try {
      window.localStorage.setItem(RAIL_KEY, railOpen ? '1' : '0');
    } catch {
      /* не запомним */
    }
    listeners.forEach((l) => l());
  };
  return [open, toggle];
}

export interface JournalLeftRailProps {
  date: ISODate;
  onDateChange: (date: ISODate) => void;
  view: JournalView;
  /** Мастера, которых можно показать (с графиком на этот день) */
  staff: Staff[];
  /** Мастера для загрузки дней в календаре */
  calendarStaffIds: Id[];
  hiddenStaffIds: Id[];
  onHiddenStaffChange: (ids: Id[]) => void;
  weekStaffId: Id;
  onWeekStaffChange: (id: Id) => void;
  /** Новая запись: нет права — кнопки нет; нельзя сейчас — неактивна с причиной */
  onCreate?: () => void;
  createDisabledReason?: string;
  createLoading?: boolean;
}

export function JournalLeftRail({
  date,
  onDateChange,
  view,
  staff,
  calendarStaffIds,
  hiddenStaffIds,
  onHiddenStaffChange,
  weekStaffId,
  onWeekStaffChange,
  onCreate,
  createDisabledReason,
  createLoading,
}: JournalLeftRailProps) {
  const t = useT('journal');

  const toggleStaff = (id: Id, checked: boolean) => {
    const next = checked ? hiddenStaffIds.filter((x) => x !== id) : [...hiddenStaffIds, id];
    // Скрыть всех нельзя — пустая сетка без объяснения (как в MastersPicker)
    if (next.length >= staff.length) return;
    onHiddenStaffChange(next);
  };

  const createButton = onCreate && (
    <button
      type="button"
      data-f="F-01-184"
      disabled={Boolean(createDisabledReason) || createLoading}
      onClick={onCreate}
      className="flex h-14 items-center gap-3 self-start rounded-2xl bg-surface pr-6 pl-4 text-sm font-semibold text-fg shadow-md transition-[box-shadow,background-color] hover:bg-primary-soft hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-surface disabled:hover:shadow-md"
    >
      <Plus aria-hidden className="size-6 text-primary" strokeWidth={2.5} />
      {t('newBooking')}
    </button>
  );

  return (
    <aside aria-label={t('board.rail.label')} className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto pr-2 pb-4">
      {createButton && createDisabledReason ? <Tooltip content={createDisabledReason}>{createButton}</Tooltip> : createButton}

      <div className="-mx-1">
        <MiniCalendarPanel value={date} onValueChange={onDateChange} staffIds={calendarStaffIds} />
      </div>

      {staff.length > 0 && (
        <section className="flex flex-col">
          <h2 className="px-1 pb-1 text-sm font-semibold text-fg">{t('board.masters.byStaff')}</h2>
          {view === 'week'
            ? staff.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={s.id === weekStaffId}
                  onClick={() => onWeekStaffChange(s.id)}
                  className={cn(
                    'flex min-h-10 items-center gap-2.5 rounded-full px-2 text-left text-sm transition-colors hover:bg-surface-2',
                    s.id === weekStaffId && 'bg-primary-soft font-semibold text-primary-text hover:bg-primary-soft',
                  )}
                >
                  <Avatar name={s.name} src={s.avatarUrl} colorIndex={s.colorIndex} size="xs" />
                  <span className="truncate">{s.name}</span>
                </button>
              ))
            : staff.map((s) => (
                <Checkbox
                  key={s.id}
                  checked={!hiddenStaffIds.includes(s.id)}
                  onCheckedChange={(v) => toggleStaff(s.id, v)}
                  className="min-h-10 items-center gap-3 rounded-full px-2 py-0 hover:bg-surface-2"
                  classNames={{ box: STAFF_BOX[s.colorIndex], label: 'min-w-0' }}
                  label={<span className="block truncate text-sm">{s.name}</span>}
                />
              ))}
        </section>
      )}
    </aside>
  );
}
