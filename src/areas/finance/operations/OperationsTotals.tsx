'use client';

/**
 * Итоги отфильтрованного списка операций (fin-review Ф17): приход, расход, сальдо — по всем страницам, а не по
 * видимой. Отменённые не считаются. Переводы между кассами внутри бизнеса — не доход и не расход: учитываются,
 * только когда выбрана одна касса (тогда это её движение денег).
 */
import type { Operation } from '@/domain/finance';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { SkeletonText } from '@/ui/Skeleton';

export interface OperationsTotalsProps {
  ops: Operation[];
  accountFiltered: boolean;
  loading: boolean;
}

export function operationsTotals(ops: Pick<Operation, 'kind' | 'amount' | 'cancelled'>[], accountFiltered: boolean) {
  let income = 0;
  let expense = 0;
  for (const op of ops) {
    if (op.cancelled) continue;
    if (op.kind === 'income' || (accountFiltered && op.kind === 'transfer_in')) income += op.amount;
    else if (op.kind === 'expense' || (accountFiltered && op.kind === 'transfer_out')) expense += op.amount;
  }
  return { income, expense, saldo: income - expense };
}

export function OperationsTotals({ ops, accountFiltered, loading }: OperationsTotalsProps) {
  const t = useT('finance');
  const format = useFormat();
  const { income, expense, saldo } = operationsTotals(ops, accountFiltered);
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
          <dd className={cn('min-h-6 text-base font-semibold tabular-nums', c.tone)}>{loading ? <SkeletonText width="10ch" /> : c.value}</dd>
        </div>
      ))}
    </dl>
  );
}
