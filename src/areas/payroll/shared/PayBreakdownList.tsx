'use client';

/**
 * З2/З7/З10 (зарплата-ревью 27.09): из чего сложилась зарплата — одна раскладка для «Расчёта за период» и
 * «Расчётной ведомости»: Услуги / Товары / Рабочий день / Записи / Доп. выручка / Доплата до минимума /
 * Премии / Штрафы / К выплате, и под ней пояснения (минимум только за целый месяц, нет графика, неоплаченные
 * визиты, товары не привязаны к мастеру). Нулевые строки не показываем, кроме итогов.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Info } from 'lucide-react';
import type { PayBreakdown } from '@/domain/payroll';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';

export interface PayBreakdownListProps {
  breakdown: PayBreakdown;
}

type Key = 'services' | 'products' | 'workday' | 'records' | 'extra' | 'minimumTopUp';
const PARTS: Key[] = ['services', 'products', 'workday', 'records', 'extra', 'minimumTopUp'];

export function PayBreakdownList({ breakdown: b }: PayBreakdownListProps) {
  const t = useT('payroll');
  const { money } = useFormat();
  const parts = PARTS.filter((k) => b[k] !== 0 || k === 'services');
  const notes: { key: string; node: ReactNode }[] = [];
  if (b.unpaidVisits > 0)
    notes.push({
      key: 'unpaid',
      node: (
        <>
          {t('period.notes.unpaid', { count: b.unpaidVisits, amount: money(b.unpaidAmount) })}{' '}
          <Link href="/biz/records" className="font-medium text-primary-text hover:underline">
            {t('period.unpaidLink')}
          </Link>
        </>
      ),
    });
  if (b.workdayNoSchedule) notes.push({ key: 'noSchedule', node: t('period.notes.workdayNoSchedule') });
  if (b.minimum && b.minimum.period === 'month' && !b.minimum.wholeMonth)
    notes.push({ key: 'minWhole', node: t('period.notes.minimumNotWholeMonth', { amount: money(b.minimum.amount) }) });
  // Решение 01.10: минимум месяца пропорционален отработанному по графику; полный — при полном графике
  if (b.minimum?.proratedAmount !== undefined)
    notes.push({
      key: 'minProrated',
      node: t('period.notes.minimumProrated', {
        amount: money(b.minimum.amount),
        prorated: money(b.minimum.proratedAmount),
        worked: b.minimum.workedHours ?? 0,
        month: b.minimum.monthHours ?? 0,
      }),
    });
  if (b.minimumTopUp > 0) notes.push({ key: 'minApplied', node: t('period.notes.minimumApplied', { amount: money(b.minimumTopUp) }) });
  if (b.productsNotLinked) notes.push({ key: 'products', node: t('period.notes.productsNotLinked') });
  if (b.extraProfitAssumed) notes.push({ key: 'extraAssumed', node: t('period.notes.extraProfitAssumed') });

  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-1.5 text-sm">
        {parts.map((k) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">{t(`period.breakdown.${k}`)}</dt>
            <dd className="tabular-nums text-fg">{money(b[k])}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
          <dt className="font-medium text-fg">{t('period.breakdown.salary')}</dt>
          <dd className="font-medium tabular-nums text-fg">{money(b.salary)}</dd>
        </div>
        {b.bonuses > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">{t('period.breakdown.bonuses')}</dt>
            <dd className="tabular-nums text-success">+{money(b.bonuses)}</dd>
          </div>
        )}
        {b.penalties > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">{t('period.breakdown.penalties')}</dt>
            <dd className="tabular-nums text-danger">−{money(b.penalties)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5">
          <dt className="font-semibold text-fg">{t('period.breakdown.toPay')}</dt>
          <dd className="font-semibold tabular-nums text-fg">{money(b.toPay)}</dd>
        </div>
      </dl>
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {notes.map((n) => (
            <li key={n.key} className="flex items-start gap-2 text-sm text-muted">
              <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>{n.node}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
