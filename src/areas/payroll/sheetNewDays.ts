'use client';

/**
 * Ответ 27 (владелец 17.11.2026): ведомость не создаётся на уже начисленные дни — сервер (и мок) отвечают
 * `period_overlaps` с новыми днями в `fields.newFrom/newTo`. Одна функция для всех мест, где начисляют ведомость:
 * у одного сотрудника — спрашиваем «Начислить только новые дни — 18.11–20.11?», в «начислить всем» — сразу только
 * новые дни, а у кого начислять нечего — считаем и показываем «Не начислено: N — дни уже в ведомостях».
 */
import { useCallback } from 'react';
import { createSheetNewDays, type SheetNewDaysResult } from '@/api/finance';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { formatDateRange } from '@/ui/DateRangePicker';
import { useConfirm, useToast } from '@/ui/Toast';

export { createSheetNewDays, type SheetNewDaysResult } from '@/api/finance';

/** Для одного сотрудника: вопрос «начислить только новые дни» и тост «всё уже начислено» */
export function useSheetNewDays() {
  const t = useT('payroll');
  const format = useFormat();
  const confirm = useConfirm();
  const toast = useToast();
  return useCallback(
    async (businessId: string, staffId: string, from: string, to: string, opts: { comment?: string; draft?: boolean } = {}): Promise<SheetNewDaysResult> => {
      const result = await createSheetNewDays(businessId, staffId, from, to, {
        ...opts,
        ask: (fresh) => {
          const period = formatDateRange(format, fresh) ?? `${fresh.from}–${fresh.to}`;
          return confirm({ title: t('statement.overlap.title'), description: t('statement.overlap.text', { period }), confirmLabel: t('statement.overlap.confirm', { period }) });
        },
      });
      if (result.status === 'covered') toast.info(t('statement.overlap.none'));
      return result;
    },
    [t, format, confirm, toast],
  );
}
