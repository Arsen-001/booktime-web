'use client';

/**
 * Отч3/Отч7/Отч10: поле периода отчёта — общий период раздела (reportPeriod.ts), длинные быстрые периоды
 * (квартал/год/90 дней), своя ширина (раньше поле тянулось на всю колонку 1120 px там, где стояло
 * прямо в flex-col страницы). Подпись «N дней» рядом — по желанию экрана.
 *
 * ReportUrlSync — применяет ?from&to&staff из ссылки «от цифры к списку» и убирает их из адреса.
 * Живёт в своём Suspense: useSearchParams без него выключил бы серверный рендер всей страницы.
 */
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useLayoutEffect, useState } from 'react';
import { applyReportParams, setReportRange, useReportRange } from '@/areas/reports/reportPeriod';
import type { DateRange } from '@/ui/Calendar';
import { DateRangePicker } from '@/ui/DateRangePicker';
import { cn } from '@/lib/cn';

export interface ReportPeriodPickerProps {
  className?: string;
}

export function ReportPeriodPicker({ className }: ReportPeriodPickerProps) {
  const range = useReportRange();
  // Первый клик по календарю — только начало периода: держим его здесь, отчёт пересчитывается
  // один раз, когда выбран и конец (раньше первый клик сразу запускал отчёт «с новой даты по старую»)
  const [draft, setDraft] = useState<DateRange | null>(null);
  return (
    <>
      <DateRangePicker
        value={draft ?? range}
        onValueChange={(r) => {
          if (r.from && r.to) {
            setDraft(null);
            setReportRange(r);
          } else setDraft(r);
        }}
        presets="long"
        className={cn('w-full sm:w-auto sm:min-w-[17rem] sm:self-start', className)}
      />
      <Suspense fallback={null}>
        <ReportUrlSync />
      </Suspense>
    </>
  );
}

function ReportUrlSync() {
  const params = useSearchParams();
  const pathname = usePathname();
  const from = params.get('from');
  const to = params.get('to');
  const staff = params.get('staff');

  useLayoutEffect(() => {
    if (!from && !to && staff === null) return;
    applyReportParams({ from, to, staff });
    const rest = new URLSearchParams(window.location.search);
    rest.delete('from');
    rest.delete('to');
    rest.delete('staff');
    const qs = rest.toString();
    window.history.replaceState(window.history.state, '', `${pathname}${qs ? `?${qs}` : ''}`);
  }, [from, to, staff, pathname]);

  return null;
}
