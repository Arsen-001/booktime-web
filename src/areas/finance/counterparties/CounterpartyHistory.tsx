'use client';

/**
 * Расчёты с контрагентом в его карточке (fin-review Ф27): сальдо с объяснением («вы заплатили на 64 000 больше, чем
 * получили») и история операций с ним — последние 20, каждая ведёт на страницу операции.
 */
import Link from 'next/link';
import { listOperations } from '@/api/finance';
import { useApiQuery } from '@/api/request';
import { counterpartyBalance } from '@/domain/finance';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { formatSignedMoney } from '@/areas/finance/money';
import { Skeleton } from '@/ui/Skeleton';

const SHOWN = 20;

export function CounterpartyHistory({ businessId, counterpartyId }: { businessId: string; counterpartyId: string }) {
  const t = useT('finance');
  const format = useFormat();
  const q = useApiQuery(['finance', 'operations', businessId, 'counterparty', counterpartyId], () =>
    listOperations(businessId, { partyType: 'counterparty', partyId: counterpartyId, cancelled: false }),
  );

  if (q.isLoading || !q.data) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton lines={3} />
      </div>
    );
  }
  const ops = q.data;
  const balance = counterpartyBalance(ops);
  const received = ops.filter((o) => o.kind === 'income').reduce((s, o) => s + o.amount, 0);
  const paid = ops.filter((o) => o.kind === 'expense').reduce((s, o) => s + o.amount, 0);

  return (
    <section data-f="F-07-023" className="flex flex-col gap-3">
      <div className="rounded-xl border border-border bg-surface-2 px-4 py-3">
        <p className="text-xs text-muted">{t('counterparties.columns.balance')}</p>
        <p className={cn('text-xl font-semibold tabular-nums', balance < 0 ? 'text-danger' : 'text-fg')}>{format.money(balance)}</p>
        <p className="mt-1 text-xs text-muted">
          {balance < 0
            ? t('counterparties.balanceExplainPaid', { amount: format.money(-balance) })
            : balance > 0
              ? t('counterparties.balanceExplainReceived', { amount: format.money(balance) })
              : t('counterparties.balanceExplainZero')}{' '}
          {t('counterparties.balanceTotals', { paid: format.money(paid), received: format.money(received) })}
        </p>
      </div>
      <h3 className="text-sm font-semibold text-fg">{t('counterparties.history')}</h3>
      {ops.length === 0 ? (
        <p className="text-sm text-muted">{t('counterparties.historyEmpty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {ops.slice(0, SHOWN).map((op) => (
            <li key={op.id}>
              <Link href={`/biz/finance/operations/${op.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-1.5 py-2 text-sm transition-colors duration-150 hover:bg-surface-2">
                <span className="flex min-w-0 flex-col">
                  <span className="text-fg">{format.date(op.date, 'short')}</span>
                  {op.comment && <span className="truncate text-xs text-muted">{op.comment}</span>}
                </span>
                <span className={cn('shrink-0 font-medium tabular-nums', op.kind === 'income' ? 'text-success' : 'text-fg')}>{formatSignedMoney(op.amount, op.kind)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
