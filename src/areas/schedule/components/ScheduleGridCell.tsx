'use client';

import { memo } from 'react';
import type { Id } from '@/domain/core';
import type { NetworkOffDayType } from '@/domain/network';
import type { ScheduleCell } from '@/api/schedule';
import { ScheduleCellView, type CellPreview } from '@/areas/schedule/components/ScheduleCellView';

export interface ScheduleGridCellProps {
  staffId: Id;
  cell: ScheduleCell;
  interactive: boolean;
  active: boolean;
  preview?: CellPreview;
  removing?: boolean;
  showDate?: boolean;
  compact?: boolean;
  locationLabel?: string;
  customTypes?: NetworkOffDayType[];
}

/**
 * Одна клетка сетки. Своих обработчиков нет — нажатия, протягивание и Shift ловит таблица по data-cell (Г4), поэтому
 * все пропсы простые, и после правки одного дня перерисовывается только эта клетка (данные с structuralSharing
 * сохраняют ссылки на неизменённые клетки, memo их пропускает).
 */
export const ScheduleGridCell = memo(function ScheduleGridCell({
  staffId,
  cell,
  interactive,
  active,
  preview,
  removing,
  showDate,
  compact,
  locationLabel,
  customTypes,
}: ScheduleGridCellProps) {
  const view = (
    <ScheduleCellView
      cell={cell}
      active={active}
      preview={preview}
      removing={removing}
      showDate={showDate}
      compact={compact}
      locationLabel={locationLabel}
      customTypes={customTypes}
    />
  );
  if (!interactive) return <span className="block">{view}</span>;
  return (
    <button
      type="button"
      data-cell={`${staffId}|${cell.date}`}
      aria-pressed={active}
      className="block w-full touch-manipulation rounded-md select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
    >
      {view}
    </button>
  );
});
