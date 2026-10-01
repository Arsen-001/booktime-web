'use client';

import { Check, Download, MoreHorizontal, Repeat, Store } from 'lucide-react';
import type { ScheduleViewConfig } from '@/domain/schedule';
import { useT } from '@/i18n/useT';
import { DropdownMenu } from '@/ui/DropdownMenu';
import { IconButton } from '@/ui/IconButton';

export interface ScheduleMoreMenuProps {
  config: ScheduleViewConfig;
  canConfigure: boolean;
  canExport: boolean;
  onExport: () => void;
  onChange: (config: ScheduleViewConfig) => void;
  /** Г12: «Повторить неделю…» для всех с графиком */
  onRepeatWeek?: () => void;
  /** Г16: «Выходной салона…» — закрыть день всем */
  onHoliday?: () => void;
}

/** «⋯» в шапке графика: «Скачать PDF…» и «Показывать в таблице» (F-02-004, F-02-016) — главное действие одно (§0) */
export function ScheduleMoreMenu({ config, canConfigure, canExport, onExport, onChange, onRepeatWeek, onHoliday }: ScheduleMoreMenuProps) {
  const t = useT('schedule');
  const mark = (on: boolean) => (on ? <Check aria-hidden /> : <span aria-hidden className="inline-block size-4" />);
  return (
    <DropdownMenu
      label={t('table.more')}
      trigger={(p) => <IconButton {...p} icon={<MoreHorizontal aria-hidden />} label={t('table.more')} variant="outline" />}
      items={[
        ...(onRepeatWeek ? [{ id: 'repeat', label: t('repeat.menuAll'), icon: <Repeat aria-hidden />, onSelect: onRepeatWeek }] : []),
        ...(onHoliday ? [{ id: 'holiday', label: t('absence.holidayMenu'), icon: <Store aria-hidden />, onSelect: onHoliday }] : []),
        ...(canExport ? [{ id: 'pdf', label: t('table.exportPdf'), icon: <Download aria-hidden />, onSelect: onExport }] : []),
        ...(canConfigure
          ? [
              { id: 'sep', separator: true as const },
              { id: 'view', groupLabel: t('view.title') },
              {
                id: 'totals',
                label: t('view.showTotals'),
                icon: mark(config.showShiftTotals),
                onSelect: () => onChange({ ...config, showShiftTotals: !config.showShiftTotals }),
              },
              {
                id: 'headcount',
                label: t('view.showHeadcount'),
                icon: mark(config.showHeadcount),
                onSelect: () => onChange({ ...config, showHeadcount: !config.showHeadcount }),
              },
            ]
          : []),
      ]}
    />
  );
}
