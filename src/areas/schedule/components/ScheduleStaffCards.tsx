'use client';

import type { MouseEvent, PointerEvent } from 'react';
import Link from 'next/link';
import type { Id, ISODate } from '@/domain/core';
import type { NetworkOffDayType } from '@/domain/network';
import type { ScheduleRow } from '@/api/schedule';
import type { CellPreview } from '@/areas/schedule/components/ScheduleCellView';
import { ScheduleGridCell } from '@/areas/schedule/components/ScheduleGridCell';
import { ScheduleRowMenu } from '@/areas/schedule/components/ScheduleRowMenu';
import { useT } from '@/i18n/useT';
import { Avatar } from '@/ui/Avatar';
import { Collapse } from '@/ui/Collapse';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';

export interface ScheduleStaffCardsProps {
  rows: ScheduleRow[];
  idleRows: ScheduleRow[];
  idleOpen: boolean;
  dates: ISODate[];
  showTotals: boolean;
  selected: Set<string>;
  preview: Map<string, CellPreview>;
  interactive: boolean;
  manages: boolean;
  canEdit: boolean;
  onSelectRow: (staffId: Id) => void;
  onCopy: (staffId: Id) => void;
  onAddTomorrow: (staffId: Id) => void;
  onRepeatWeek: (staffId: Id) => void;
  totalsText: (row: ScheduleRow) => string;
  locationLabel: (id: Id | undefined) => string | undefined;
  customTypes?: NetworkOffDayType[];
  skeletonRows?: number;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
}

/**
 * Телефон, неделя: карточка на сотрудника, дни — сеткой 7 в ряд. Г4: нажатие по дню отмечает его (шторка не
 * открывается сама — «Настроить (N)» в полосе снизу), так на телефоне выбираются несколько дней и мастеров.
 */
export function ScheduleStaffCards(p: ScheduleStaffCardsProps) {
  const t = useT('schedule');

  const card = (row: ScheduleRow) => (
    <div key={row.staff.id} className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <Avatar name={row.staff.name} src={row.staff.avatarUrl} colorIndex={row.staff.colorIndex} size="sm" />
        {p.manages ? (
          <button
            type="button"
            onClick={() => p.onSelectRow(row.staff.id)}
            aria-label={t('table.selectRow', { name: row.staff.name })}
            className="flex min-h-11 min-w-0 flex-1 flex-col justify-center text-left"
          >
            <span className="truncate text-base font-medium text-fg">{row.staff.name}</span>
            {p.showTotals && <span className="text-sm text-muted">{p.totalsText(row)}</span>}
          </button>
        ) : (
          <Link href={`/biz/staff/${row.staff.id}`} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
            <span className="truncate text-base font-medium text-fg">{row.staff.name}</span>
            {p.showTotals && <span className="text-sm text-muted">{p.totalsText(row)}</span>}
          </Link>
        )}
        <ScheduleRowMenu
          staffId={row.staff.id}
          staffName={row.staff.name}
          canEdit={p.canEdit}
          onCopy={p.onCopy}
          onAddTomorrow={p.onAddTomorrow}
          onRepeatWeek={p.onRepeatWeek}
        />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {p.dates.map((date) => {
          const cell = row.cells.find((c) => c.date === date);
          const key = `${row.staff.id}|${date}`;
          return cell ? (
            <ScheduleGridCell
              key={date}
              staffId={row.staff.id}
              cell={cell}
              interactive={p.interactive}
              active={p.selected.has(key)}
              preview={p.preview.get(key)}
              showDate
              locationLabel={p.locationLabel(cell.locationId)}
              customTypes={p.customTypes}
            />
          ) : (
            <span key={date} className="block h-14 rounded-md bg-surface" />
          );
        })}
      </div>
    </div>
  );

  // Скелетон карточки — та же разметка, что у card: имя и «Итого» полосами в тех же строках, место под «⋮»
  const skeletonCard = (i: number) => (
    <div key={`sk${i}`} className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex min-h-11 items-center gap-2">
        <Skeleton variant="circle" className="size-8 shrink-0" />
        <span className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
          <span className="truncate text-base font-medium text-fg">
            <SkeletonText width={i % 2 ? '15ch' : '13ch'} />
          </span>
          {p.showTotals && (
            <span className="text-sm text-muted">
              <SkeletonText width="11ch" />
            </span>
          )}
        </span>
        <span aria-hidden className="flex size-11 shrink-0" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {p.dates.map((d) => (
          <Skeleton key={d} variant="rect" className="block h-14 rounded-md" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 sm:hidden" onClick={p.onClick} onPointerDown={p.onPointerDown} aria-busy={p.skeletonRows ? true : undefined}>
      {p.skeletonRows ? Array.from({ length: p.skeletonRows }, (_, i) => skeletonCard(i)) : p.rows.map(card)}
      <Collapse open={p.idleOpen && p.idleRows.length > 0} className="flex flex-col gap-3">
        {p.idleRows.map(card)}
      </Collapse>
    </div>
  );
}
