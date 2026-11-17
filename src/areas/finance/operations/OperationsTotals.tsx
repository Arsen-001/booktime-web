'use client';

/**
 * Итоги отфильтрованного списка операций (fin-review Ф17): приход, расход, сальдо — по всем страницам, а не по
 * видимой. Считает тот, кто отдаёт страницу (operationTotals: сервер или моковая база), — экран только показывает.
 */
import type { Money } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { SkeletonText } from '@/ui/Skeleton';

export interface OperationsTotalsProps {
  totals: { income: Money; expense: Money } | undefined;
  loading: boolean;
}

export function OperationsTotals({ totals, loading }: OperationsTotalsProps) {
  const t = useT('finance');
  const format = useFormat();
  const income = totals?.income ?? 0;
  const expense = totals?.expense ?? 0;
  const saldo = income - expense;
  const cells = [
    { id: 'income', label: t('operations.totals.income'), value: format.money(income), tone: 'text-success' },
    { id: 'expense', label: t('operations.totals.expense'), value: format.money(expense), tone: 'text-fg' },
    { id: 'saldo', label: t('operations.totals.saldo'), value: `${saldo > 0 ? '+' : ''}${format.money(saldo)}`, tone: saldo < 0 ? 'text-danger' : 'text-fg' },
  ];
  return (
    <dl data-f="F-07-011" aria-busy={loading || undefined} className="flex flex-wrap gap-x-6 gap-y-2">
      {cells.map((c) => (
        <div key={c.id} className="flex min-w-24 flex-col">
          <dt className="text-xs text-muted">{c.label}</dt>
          <dd className={cn('min-h-6 text-base font-semibold tabular-nums', c.tone)}>{loading || !totals ? <SkeletonText width="10ch" /> : c.value}</dd>
        </div>
      ))}
    </dl>
  );
}
