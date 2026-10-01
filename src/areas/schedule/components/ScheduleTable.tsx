'use client';

import type { PointerEvent, MouseEvent, ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { Users } from 'lucide-react';
import Link from 'next/link';
import type { Id, ISODate } from '@/domain/core';
import type { NetworkOffDayType } from '@/domain/network';
import type { ScheduleRow } from '@/api/schedule';
import type { CellPreview } from '@/areas/schedule/components/ScheduleCellView';
import { ScheduleGridCell } from '@/areas/schedule/components/ScheduleGridCell';
import { ScheduleRowMenu } from '@/areas/schedule/components/ScheduleRowMenu';
import type { ScheduleView } from '@/areas/schedule/lib/grid';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { today, weekdayIndex } from '@/lib/date';
import { Avatar } from '@/ui/Avatar';
import { Skeleton, SkeletonText } from '@/ui/Skeleton';
import { DURATION, EASE, useMotionPreset, type MotionPreset } from '@/ui/motion';

/** М4: строки «Без графика» появляются и уходят одним плавным проявлением всего блока, а не за один кадр */
const IDLE_ROWS: MotionPreset = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: DURATION.normal, ease: EASE.out } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE.in } },
};

export interface ScheduleTableProps {
  rows: ScheduleRow[];
  idleRows: ScheduleRow[];
  idleOpen: boolean;
  dates: ISODate[];
  view: ScheduleView;
  showTotals: boolean;
  showHeadcount: boolean;
  headcount: Record<ISODate, number>;
  staffCount: number;
  selected: Set<string>;
  drag: { keys: Set<string>; removing: boolean } | null;
  preview: Map<string, CellPreview>;
  /** Клетки нажимаются (выбор или переход в свой календарь) */
  interactive: boolean;
  /** Ведёт график: выбор строк и столбцов, меню правки */
  manages: boolean;
  canEdit: boolean;
  onSelectRow: (staffId: Id) => void;
  onSelectColumn: (date: ISODate) => void;
  onCopy: (staffId: Id) => void;
  onAddTomorrow: (staffId: Id) => void;
  onRepeatWeek: (staffId: Id) => void;
  totalsText: (row: ScheduleRow) => string;
  locationLabel: (id: Id | undefined) => string | undefined;
  customTypes?: NetworkOffDayType[];
  /** Загрузка: столько строк-скелетов той же высоты (М2) */
  skeletonRows?: number;
  /** Идёт загрузка другой недели/месяца: тонкая полоса сверху, таблица не тускнеет (М1) */
  refreshing?: boolean;
  handlers?: {
    onPointerDown: (e: PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: PointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onClick: (e: MouseEvent<HTMLElement>) => void;
  };
}

/**
 * Таблица «Сотрудники × дни» (F-02-002): неделя на планшете и десктопе, месяц — везде (Г9: на широком экране месяц
 * целиком узкими клетками, на телефоне — одна общая прокрутка с закреплёнными именами и буквой дня недели).
 */
/** Ширины имён в скелетоне — типичные «Имя Фамилия» демо */
const SKELETON_NAMES = ['14ch', '16ch', '14ch', '16ch', '15ch', '14ch'];

export function ScheduleTable(p: ScheduleTableProps) {
  const t = useT('schedule');
  const format = useFormat();
  const idleAnim = useMotionPreset(IDLE_ROWS);
  const now = today();
  const month = p.view === 'month';
  const letters = format.weekdaysShort();

  const renderRow = (row: ScheduleRow) => (
    <tr key={row.staff.id}>
      <th scope="row" className={cn('sticky left-0 z-10 bg-bg py-1 pr-2 text-left font-normal', month && 'pr-1')}>
        <div className="flex min-h-11 items-center gap-2">
          <Avatar name={row.staff.name} src={row.staff.avatarUrl} colorIndex={row.staff.colorIndex} size="sm" className={cn(month && 'max-sm:hidden')} />
          {p.manages ? (
            <button
              type="button"
              onClick={() => p.onSelectRow(row.staff.id)}
              aria-label={t('table.selectRow', { name: row.staff.name })}
              className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center rounded-md text-left hover:underline focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="w-full truncate text-sm font-medium text-fg">{month ? row.staff.name.split(' ')[0] : row.staff.name}</span>
              {month && p.showTotals && <span className="w-full truncate text-xs text-muted">{p.totalsText(row)}</span>}
            </button>
          ) : (
            <Link href={`/biz/staff/${row.staff.id}`} className="flex min-h-11 min-w-0 flex-1 items-center truncate text-sm font-medium text-fg hover:underline">
              {row.staff.name}
            </Link>
          )}
          <ScheduleRowMenu
            staffId={row.staff.id}
            staffName={row.staff.name}
            canEdit={p.canEdit}
            onCopy={p.onCopy}
            onAddTomorrow={p.onAddTomorrow}
            onRepeatWeek={p.onRepeatWeek}
            compact={month}
          />
        </div>
      </th>
      {p.dates.map((date) => {
        const cell = row.cells.find((c) => c.date === date);
        const key = `${row.staff.id}|${date}`;
        const inDrag = p.drag?.keys.has(key) ?? false;
        const active = inDrag ? !p.drag?.removing : p.selected.has(key);
        return (
          <td key={date} className={month ? 'px-px' : 'px-1'}>
            {cell ? (
              <ScheduleGridCell
                staffId={row.staff.id}
                cell={cell}
                interactive={p.interactive}
                active={active || (inDrag && Boolean(p.drag?.removing))}
                removing={inDrag && p.drag?.removing}
                preview={p.preview.get(key)}
                compact={month}
                locationLabel={p.locationLabel(cell.locationId)}
                customTypes={p.customTypes}
              />
            ) : (
              <span className={cn('block rounded-md bg-surface', month ? 'h-12' : 'h-14')} />
            )}
          </td>
        );
      })}
      {p.showTotals && !month && (
        <td className={cn('py-1 pl-2 text-sm whitespace-nowrap', row.totalDays > 0 ? 'text-fg' : 'text-muted')}>{p.totalsText(row)}</td>
      )}
    </tr>
  );

  // Скелетон строки — та же разметка, что у renderRow (DESIGN.md → «The skeleton IS the page»): аватар, имя полосой в
  // том же элементе, место под «⋮» 44px, клетки дня той же высоты, «Итого» полосой в той же ячейке
  const skeletonRow = (i: number) => (
    <tr key={`sk${i}`} data-skeleton-row="">
      <th scope="row" className={cn('sticky left-0 z-10 bg-bg py-1 pr-2 text-left font-normal', month && 'pr-1')}>
        <div className="flex min-h-11 items-center gap-2">
          <Skeleton variant="circle" className={cn('size-8 shrink-0', month && 'max-sm:hidden')} />
          <span className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center">
            <span className="w-full truncate text-sm font-medium text-fg">
              <SkeletonText width={month ? '7ch' : SKELETON_NAMES[i % SKELETON_NAMES.length]} />
            </span>
            {month && p.manages && p.showTotals && (
              <span className="w-full truncate text-xs text-muted">
                <SkeletonText width="11ch" />
              </span>
            )}
          </span>
          <span aria-hidden className={cn('flex size-11 shrink-0', month && 'max-sm:w-7')} />
        </div>
      </th>
      {p.dates.map((date) => (
        <td key={date} className={month ? 'px-px' : 'px-1'}>
          <Skeleton variant="rect" className={cn('block w-full rounded-md', month ? 'h-12' : 'h-14 min-w-16')} />
        </td>
      ))}
      {p.showTotals && !month && (
        <td className="py-1 pl-2 text-sm whitespace-nowrap text-muted">
          <SkeletonText width="12ch" />
        </td>
      )}
    </tr>
  );

  const header: ReactNode = (
    <tr>
      <th className={cn('sticky left-0 z-10 bg-bg px-2 pb-2 text-left align-bottom text-sm font-medium text-muted', !month && 'min-w-48')}>
        {month ? '' : p.skeletonRows ? <SkeletonText width="13ch" /> : t('table.staffColumn', { n: p.staffCount })}
      </th>
      {p.dates.map((date) => {
        const weekend = weekdayIndex(date) >= 5;
        const isToday = date === now;
        const count = p.headcount[date] ?? 0;
        const content = (
          <>
            <div className="first-letter:uppercase">{month ? letters[weekdayIndex(date)] : format.date(date, 'weekday').split(',')[0]}</div>
            <div className="mt-0.5 flex justify-center">
              <span
                className={cn(
                  'grid place-items-center rounded-full font-semibold tabular-nums',
                  month ? 'size-6 text-xs' : 'size-7 text-sm',
                  isToday ? 'bg-primary text-primary-contrast' : 'text-fg',
                )}
                aria-label={isToday ? t('table.todayLabel') : undefined}
              >
                {Number(date.slice(8, 10))}
              </span>
            </div>
            {p.showHeadcount && !month && (
              <div className="mt-1 flex items-center justify-center gap-1 text-xs font-normal text-muted" aria-label={t('table.headcount', { n: count })}>
                <Users className="size-3.5" aria-hidden />
                <span aria-hidden>{p.skeletonRows ? <SkeletonText width="1ch" /> : count || '–'}</span>
              </div>
            )}
          </>
        );
        return (
          <th
            key={date}
            scope="col"
            className={cn(
              'rounded-t-lg pb-2 text-center align-bottom font-medium',
              month ? 'px-0 text-xs' : 'min-w-16 px-1 text-sm',
              weekend ? 'bg-surface-2/60 text-muted' : 'text-muted',
            )}
          >
            {p.manages ? (
              <button
                type="button"
                onClick={() => p.onSelectColumn(date)}
                aria-label={t('table.selectColumn', { date: format.date(date, 'weekday') })}
                className="w-full rounded-md py-0.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-focus"
              >
                {content}
              </button>
            ) : (
              content
            )}
          </th>
        );
      })}
      {p.showTotals && !month && <th className="min-w-28 px-2 pb-2 text-left align-bottom text-sm font-medium text-muted">{t('table.totals')}</th>}
    </tr>
  );

  return (
    <div
      className={cn('relative overflow-x-auto', month ? 'block' : 'hidden sm:block')}
      aria-busy={p.skeletonRows ? true : undefined}
      {...(p.skeletonRows ? {} : p.handlers)}
    >
      <span
        aria-hidden
        className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 rounded-full bg-primary/60 transition-opacity duration-150', p.refreshing ? 'opacity-100' : 'opacity-0')}
      />
      <table
        className={cn('w-full border-separate', month ? 'table-fixed border-spacing-y-1' : 'border-spacing-y-1.5')}
        style={month ? { minWidth: 'calc(6.5rem + 31 * 1.875rem)' } : undefined}
        aria-label={t('table.title')}
      >
        {month && (
          <colgroup>
            <col className="w-26 sm:w-44" />
            {p.dates.map((d) => (
              <col key={d} />
            ))}
          </colgroup>
        )}
        <thead>{header}</thead>
        <tbody>{p.skeletonRows ? Array.from({ length: p.skeletonRows }, (_, i) => skeletonRow(i)) : p.rows.map(renderRow)}</tbody>
        <AnimatePresence initial={false}>
          {p.idleOpen && p.idleRows.length > 0 && (
            <m.tbody key="idle" {...idleAnim}>
              {p.idleRows.map(renderRow)}
            </m.tbody>
          )}
        </AnimatePresence>
      </table>
    </div>
  );
}
