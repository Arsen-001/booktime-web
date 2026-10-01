'use client';

/**
 * Вводные окупаемости (оценка): деньги — с «֏», проценты — с «%», пересчёт сразу при вводе, итог рядом
 * (на десктопе — липкий справа). Сохраняется тихо, когда уходите с поля, без кнопки «Пересчитать».
 */
import { useState } from 'react';
import { savePaybackInputs } from '@/api/platform';
import { useApiMutation } from '@/api/request';
import { UnitNumberField } from '@/areas/platform/components/UnitNumberField';
import { usePayingNow } from '@/areas/platform/hooks/usePlatformData';
import { PaybackResultCard } from '@/areas/platform/plan/PaybackResultCard';
import { computePayback, type PaybackInputs } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Badge } from '@/ui/Badge';
import { FormField } from '@/ui/FormField';
import { MoneyInput } from '@/ui/MoneyInput';
import { SectionCard } from '@/ui/SectionCard';
import { useToast } from '@/ui/Toast';

type MoneyKey = 'monthlyCosts' | 'targetNet' | 'individualPrice' | 'salonPerMaster' | 'usdRate' | 'eurRate';

export function PaybackForm({ initial }: { initial: PaybackInputs }) {
  const t = useT('platform');
  const toast = useToast();
  const payingQ = usePayingNow();
  const save = useApiMutation(savePaybackInputs);
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const set = (patch: Partial<PaybackInputs>) => setValues((v) => ({ ...v, ...patch }));
  const result = computePayback(values);

  const saveIfChanged = async () => {
    if (JSON.stringify(values) === JSON.stringify(saved)) return;
    try {
      await save.mutate(values);
      setSaved(values);
      toast.success(t('plan.saved'));
    } catch {
      toast.error(t('plan.saveFailed'));
    }
  };

  const money = (key: MoneyKey, label: string) => (
    <FormField label={label}>
      <MoneyInput value={values[key]} onValueChange={(v) => set({ [key]: v ?? 0 })} />
    </FormField>
  );

  return (
    <div data-f="F-00-206" className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      {/* Сохраняем, когда фокус ушёл из всей формы, а не с каждого поля: переход Tab между полями — не сохранение с тостом */}
      <div
        className="flex flex-col gap-5"
        onBlur={(e) => {
          if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
          void saveIfChanged();
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-fg">{t('plan.paybackTitle')}</h2>
          <Badge tone="warning">{t('plan.paybackEstimateBadge')}</Badge>
        </div>
        <SectionCard title={t('plan.sectionCosts')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {money('monthlyCosts', t('plan.monthlyCosts'))}
            {money('targetNet', t('plan.targetNet'))}
          </div>
        </SectionCard>
        <SectionCard title={t('plan.sectionPrices')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {money('salonPerMaster', t('plan.salonPerMaster'))}
            {money('individualPrice', t('plan.individualPrice'))}
            <UnitNumberField label={t('plan.avgMasters')} value={values.avgMasters} unit={t('plan.mastersUnit')} onChange={(n) => set({ avgMasters: n })} hint={t('plan.avgMastersHint')} />
            <UnitNumberField label={t('plan.discountShare')} value={values.discountShare} unit="%" onChange={(n) => set({ discountShare: Math.min(100, n) })} />
            <UnitNumberField label={t('plan.discountPercent')} value={values.discountPercent} unit="%" onChange={(n) => set({ discountPercent: Math.min(100, n) })} />
          </div>
        </SectionCard>
        <SectionCard title={t('plan.sectionRates')}>
          <div className="grid gap-4 sm:grid-cols-2">
            {money('usdRate', t('plan.usdRate'))}
            {money('eurRate', t('plan.eurRate'))}
          </div>
        </SectionCard>
      </div>
      <div className="max-lg:order-first lg:sticky lg:top-24">
        <PaybackResultCard inputs={values} result={result} paying={payingQ.data} payingLoading={payingQ.isLoading} />
      </div>
    </div>
  );
}
