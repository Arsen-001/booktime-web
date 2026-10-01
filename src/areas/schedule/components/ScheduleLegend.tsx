'use client';

import { House } from 'lucide-react';
import type { ScheduleRow } from '@/api/schedule';
import type { DayTypeId } from '@/domain/schedule';
import { dayTypeById } from '@/domain/schedule';
import { CELL_BG, DAY_TYPE_ICON } from '@/areas/schedule/components/ScheduleCellView';
import { useT } from '@/i18n/useT';
import { useTDynamic } from '@/i18n/useTDynamic';
import { cn } from '@/lib/cn';
import { SkeletonText } from '@/ui/Skeleton';

/** Легенда под таблицей (ux-r2 M-8): только то, что есть на экране — рабочий день, дома, типы дня, «есть записи» */
export function ScheduleLegend({ rows, loading }: { rows: ScheduleRow[]; loading?: boolean }) {
  const t = useT('schedule');
  const tDyn = useTDynamic();
  const cells = rows.flatMap((r) => r.cells);
  // Первая загрузка: строка легенды уже на месте — «Рабочий день» и полосы вместо пунктов, которые зависят от данных
  if (loading)
    return (
      <ul aria-busy className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted" aria-label={t('table.legend')}>
        <li className="flex items-center gap-2">
          <span className={cn('size-4 rounded', CELL_BG.work)} aria-hidden />
          {t('dayTypes.work')}
        </li>
        <li className="flex items-center gap-2">
          <span className="size-4 rounded bg-surface-2" aria-hidden />
          <SkeletonText width="15ch" />
        </li>
        <li className="flex items-center gap-2">
          <SkeletonText width="11ch" />
        </li>
      </ul>
    );
  if (cells.length === 0) return null;
  const types = new Set<DayTypeId>();
  for (const c of cells) if (c.typeId && c.typeId !== 'work' && c.typeId !== 'not_working') types.add(c.typeId);
  const hasHome = cells.some((c) => c.elsewhere?.length);
  const hasBookings = cells.some((c) => c.hasBookings);

  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted" aria-label={t('table.legend')}>
      <li className="flex items-center gap-2">
        <span className={cn('size-4 rounded', CELL_BG.work)} aria-hidden />
        {t('dayTypes.work')}
      </li>
      {hasHome && (
        <li className="flex items-center gap-2">
          <span className={cn('grid size-4 place-items-center rounded', CELL_BG.elsewhere)} aria-hidden>
            <House className="size-3" />
          </span>
          {t('table.elsewhereLegend')}
        </li>
      )}
      {[...types].map((id) => {
        const Icon = DAY_TYPE_ICON[id];
        return (
          <li key={id} className="flex items-center gap-2">
            <span className={cn('grid size-4 place-items-center rounded', CELL_BG[id])} aria-hidden>
              {Icon && <Icon className="size-3" />}
            </span>
            {tDyn(`schedule.${dayTypeById(id).labelKey}`)}
          </li>
        );
      })}
      {hasBookings && (
        <li className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          {t('table.hasBookings')}
        </li>
      )}
    </ul>
  );
}
