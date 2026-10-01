'use client';

import type { PlanCounts } from '@/api/schedule';
import { useT } from '@/i18n/useT';

/**
 * Г2: одна формулировка итога плана — и в предпросмотре («Станет: …»), и в тосте после записи («Готово: …»). Числа
 * берутся из одного расчёта (countPlan в api), поэтому предпросмотр и тост совпадают до дня.
 */
export function usePlanText() {
  const t = useT('schedule');
  const totals = (c: PlanCounts) => [c.work ? t('plan.work', { n: c.work }) : '', c.off ? t('plan.off', { n: c.off }) : ''].filter(Boolean).join(', ');
  return {
    nothing: (c: PlanCounts) => c.added + c.changed + c.removed === 0,
    preview: (c: PlanCounts) =>
      [
        t('plan.willBe', { list: totals(c) }),
        c.added ? t('plan.add', { n: c.added }) : '',
        c.changed ? t('plan.change', { n: c.changed }) : '',
        c.removed ? t('plan.remove', { n: c.removed }) : '',
      ]
        .filter(Boolean)
        .join(' · '),
    done: (c: PlanCounts) =>
      [
        t('plan.done', { list: totals(c) }),
        c.added ? t('plan.added', { n: c.added }) : '',
        c.changed ? t('plan.changed', { n: c.changed }) : '',
        c.removed ? t('plan.removed', { n: c.removed }) : '',
      ]
        .filter(Boolean)
        .join(' · '),
  };
}
