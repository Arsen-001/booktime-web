'use client';

/** Итог окупаемости: сколько салонов или индивидуалов нужно, выход в ноль и сколько платят сейчас. */
import type { PaybackInputs, PaybackResult, PayingNow } from '@/domain/platform';
import { useFormat } from '@/i18n/useFormat';
import { useT } from '@/i18n/useT';
import { KeyValueList } from '@/ui/KeyValueList';
import { Skeleton } from '@/ui/Skeleton';

interface PaybackResultCardProps {
  inputs: PaybackInputs;
  result: PaybackResult;
  paying?: PayingNow;
  payingLoading: boolean;
}

export function PaybackResultCard({ inputs, result, paying, payingLoading }: PaybackResultCardProps) {
  const t = useT('platform');
  const fmt = useFormat();
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-primary/30 bg-primary-soft/40 p-5">
      <div>
        <p className="text-sm text-muted">{t('plan.needToEarn', { total: fmt.money(result.totalNeeded) })}</p>
        <p className="mt-1 text-2xl leading-snug font-semibold text-fg">{t('plan.needSalons', { salons: result.salonsNeeded, individuals: result.individualsNeeded })}</p>
        <p className="mt-1 text-sm text-muted">{t('plan.inCurrency', { usd: fmt.number(result.totalInUsd), eur: fmt.number(result.totalInEur) })}</p>
      </div>
      <KeyValueList
        dense
        items={[
          { label: t('plan.breakevenTitle'), value: t('plan.breakevenValue', { salons: result.breakevenSalons, individuals: result.breakevenIndividuals }), hint: t('plan.breakevenNote', { costs: fmt.money(inputs.monthlyCosts) }) },
          { label: t('plan.avgSalon'), value: t('plan.perMonth', { money: fmt.money(result.avgSalonRevenue) }) },
          { label: t('plan.avgIndividual'), value: t('plan.perMonth', { money: fmt.money(result.avgIndividualRevenue) }) },
          {
            label: t('plan.resultCurrentlyPaying'),
            value: payingLoading || !paying ? <Skeleton className="h-4 w-24" /> : t('plan.payingValue', { salons: paying.salons, individuals: paying.individuals }),
          },
        ]}
      />
    </div>
  );
}
