'use client';

/** Z-отчёт смены (fin-review Ф1): остаток на открытии, приход по способам, расход и возвраты, переводы, итог и расхождение */
import type { CashShiftView } from '@/api/finance';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';

export function ZReportView({ view }: { view: CashShiftView }) {
  const t = useT('finance');
  const format = useFormat();
  const { shift, report, discrepancy } = view;
  const rows: { id: string; label: string; value: number; sign?: '+' | '−'; strong?: boolean }[] = [
    { id: 'opening', label: t('shift.report.opening'), value: report.openingBalance },
    { id: 'cash', label: t('shift.report.incomeCash'), value: report.incomeByMethod.cash, sign: '+' },
    { id: 'card', label: t('shift.report.incomeOther'), value: report.income - report.incomeByMethod.cash, sign: '+' },
    { id: 'tin', label: t('shift.report.transfersIn'), value: report.transfersIn, sign: '+' },
    { id: 'expense', label: t('shift.report.expense'), value: report.expense - report.refunds, sign: '−' },
    { id: 'refunds', label: t('shift.report.refunds'), value: report.refunds, sign: '−' },
    { id: 'tout', label: t('shift.report.transfersOut'), value: report.transfersOut, sign: '−' },
    { id: 'expected', label: t('shift.report.expected'), value: report.expected, strong: true },
  ];
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-xs text-muted">
        {format.dateTime(shift.openedAt)} — {shift.closedAt ? format.dateTime(shift.closedAt) : t('shift.report.stillOpen')} · {t('shift.report.ops', { count: report.operationsCount })}
      </p>
      <dl className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.id} className={cn('flex justify-between gap-3', r.strong && 'border-t border-border pt-1.5 font-semibold')}>
            <dt className={r.strong ? 'text-fg' : 'text-muted'}>{r.label}</dt>
            <dd className="tabular-nums">
              {r.sign && r.value > 0 ? `${r.sign}${format.money(r.value)}` : format.money(r.value)}
            </dd>
          </div>
        ))}
        {shift.countedCash !== undefined && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{t('shift.report.counted')}</dt>
            <dd className="tabular-nums">{format.money(shift.countedCash)}</dd>
          </div>
        )}
        {discrepancy !== undefined && (
          <div className="flex justify-between gap-3">
            <dt className="text-muted">{discrepancy === 0 ? t('shift.matches') : discrepancy > 0 ? t('shift.surplus') : t('shift.shortage')}</dt>
            <dd className={cn('font-semibold tabular-nums', discrepancy < 0 ? 'text-danger' : discrepancy > 0 ? 'text-warning-text' : 'text-success')}>
              {format.money(Math.abs(discrepancy))}
            </dd>
          </div>
        )}
      </dl>
      {shift.comment && <p className="text-xs text-muted">{shift.comment}</p>}
    </div>
  );
}
