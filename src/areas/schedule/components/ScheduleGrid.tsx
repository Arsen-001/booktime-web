'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Id, ISODate } from '@/domain/core';
import type { NetworkOffDayType } from '@/domain/network';
import type { ScheduleCell, ScheduleRow } from '@/api/schedule';
import type { CellPreview } from '@/areas/schedule/components/ScheduleCellView';
import { ScheduleStaffCards } from '@/areas/schedule/components/ScheduleStaffCards';
import { ScheduleTable } from '@/areas/schedule/components/ScheduleTable';
import type { ScheduleView } from '@/areas/schedule/lib/grid';
import { useGridSelection, type CellRef, type SelectOp } from '@/areas/schedule/lib/useGridSelection';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

export interface ScheduleGridProps {
  rows: ScheduleRow[];
  dates: ISODate[];
  view: ScheduleView;
  showTotals: boolean;
  showHeadcount: boolean;
  selected: Set<string>;
  preview: Map<string, CellPreview>;
  /** Ячейки можно нажимать (выбор для правки или переход в свой календарь) */
  interactive: boolean;
  /** Ведёт график всех: нажатие выбирает клетки (Г4); иначе — переход в свой календарь */
  manages: boolean;
  /** Правка графика других: меню строки с «Рабочий день завтра», «Скопировать», «Повторить неделю» */
  canEdit: boolean;
  onSelect: (cells: CellRef[], op: SelectOp) => void;
  onOpenDay: (staffId: Id, date: ISODate) => void;
  onCopy: (staffId: Id) => void;
  onAddTomorrow: (staffId: Id) => void;
  onRepeatWeek: (staffId: Id) => void;
  /** Первая загрузка: скелет ровно этой формы (М2) */
  loading: boolean;
  skeletonRows: number;
  /** Будет строка «Без графика: N» — место под неё и в скелете (М2) */
  skeletonIdleToggle?: boolean;
  /** Грузится другая неделя/месяц — прежняя таблица остаётся как есть, сверху тонкая полоса (М1) */
  refreshing?: boolean;
  emptyTitle: string;
  emptyText: string;
  /** S-4: список пуст из-за фильтров — «Сбросить фильтры» (F-02-003) */
  emptyKind?: 'default' | 'search';
  onResetFilters?: () => void;
  emptyAction?: ReactNode;
  /** F-02-011: свои типы нерабочих дней сети — имя и цвет ячейки вместо генерик-фолбэка */
  customTypes?: NetworkOffDayType[];
  /** Г6: подпись филиала в клетке (у мастера нескольких филиалов при «Все филиалы») */
  locationLabel: (id: Id | undefined) => string | undefined;
}

function works(cell: ScheduleCell | undefined): boolean {
  if (!cell) return false;
  return (cell.hours.length > 0 && cell.typeId !== 'not_working') || Boolean(cell.elsewhere?.length);
}

/**
 * Таблица «Сотрудники × дни» (F-02-002): на телефоне неделя — карточки, месяц — одна общая таблица; на десктопе —
 * таблица с прокруткой внутри своего блока. Люди без графика свёрнуты в строку внизу (ux-best-c3 №1), раскрываются
 * плавно (М4). Выбор клеток — протягиванием, Shift, по дате и по имени (Г4).
 */
export function ScheduleGrid(p: ScheduleGridProps) {
  const t = useT('schedule');
  const format = useFormat();
  const [showIdle, setShowIdle] = useState(false);

  const active = p.rows.filter((r) => r.totalDays > 0);
  const idle = p.rows.filter((r) => r.totalDays === 0);
  const collapsible = active.length > 0 && idle.length > 0;
  const visible = collapsible ? active : p.rows;
  const idleOpen = collapsible && showIdle;
  const orderIds = [...visible, ...(idleOpen ? idle : [])].map((r) => r.staff.id);

  const selection = useGridSelection(orderIds, p.dates, p.selected, p.onSelect);
  const openDay = (e: MouseEvent<HTMLElement>) => {
    const key = (e.target as Element).closest<HTMLElement>('[data-cell]')?.dataset.cell;
    if (!key) return;
    const i = key.lastIndexOf('|');
    p.onOpenDay(key.slice(0, i), key.slice(i + 1));
  };

  if (!p.loading && p.rows.length === 0)
    return (
      <EmptyState
        title={p.emptyTitle}
        description={p.emptyText}
        kind={p.emptyKind}
        onReset={p.emptyKind === 'search' ? p.onResetFilters : undefined}
        action={p.emptyKind === 'default' ? p.emptyAction : undefined}
      />
    );

  const headcount: Record<ISODate, number> = {};
  for (const date of p.dates) headcount[date] = p.rows.filter((r) => works(r.cells.find((c) => c.date === date))).length;
  const totalsText = (row: ScheduleRow) =>
    row.totalDays > 0 ? t('table.totalsValue', { days: row.totalDays, hours: format.duration(row.totalMinutes) }) : t('table.totalsEmpty');
  const selectLine = (cells: CellRef[]) => {
    const allOn = cells.length > 0 && cells.every((c) => p.selected.has(`${c.staffId}|${c.date}`));
    p.onSelect(cells, allOn ? 'remove' : 'add');
  };
  const onSelectRow = (staffId: Id) => selectLine(p.dates.map((date) => ({ staffId, date })));
  const onSelectColumn = (date: ISODate) => selectLine(orderIds.map((staffId) => ({ staffId, date })));
  const skeletonRows = p.loading ? Math.max(1, p.skeletonRows) : undefined;
  const common = {
    idleRows: idle,
    idleOpen,
    dates: p.dates,
    showTotals: p.showTotals,
    selected: p.selected,
    preview: p.preview,
    interactive: p.interactive,
    manages: p.manages,
    canEdit: p.canEdit,
    onSelectRow,
    onCopy: p.onCopy,
    onAddTomorrow: p.onAddTomorrow,
    onRepeatWeek: p.onRepeatWeek,
    totalsText,
    locationLabel: p.locationLabel,
    customTypes: p.customTypes,
    skeletonRows,
  };

  return (
    <div data-f="F-02-001 F-02-002 F-02-004 F-02-032" className="flex flex-col gap-3">
      {p.view === 'week' && (
        <ScheduleStaffCards {...common} rows={visible} onClick={p.manages ? selection.handlers.onClick : openDay} />
      )}
      <ScheduleTable
        {...common}
        rows={visible}
        view={p.view}
        showHeadcount={p.showHeadcount}
        headcount={headcount}
        staffCount={p.rows.length}
        drag={selection.drag}
        onSelectColumn={onSelectColumn}
        refreshing={p.refreshing}
        handlers={
          p.manages
            ? selection.handlers
            : { onPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {}, onPointerCancel: () => {}, onClick: openDay }
        }
      />
      {collapsible && !p.loading && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-muted"
          rightIcon={<ChevronDown aria-hidden className={cn('transition-transform', showIdle && 'rotate-180')} />}
          onClick={() => setShowIdle((v) => !v)}
        >
          {showIdle ? t('table.hideIdle') : t('table.showIdle', { n: idle.length })}
        </Button>
      )}
      {p.loading && p.skeletonIdleToggle && <div aria-hidden className="h-10 md:h-9" />}
    </div>
  );
}
