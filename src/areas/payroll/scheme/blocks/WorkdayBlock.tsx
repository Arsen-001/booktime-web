'use client';

/**
 * Блок «Оплата за рабочий день» (F-09-036, F-09-037, F-09-038). Принадлежит разделу «payroll».
 * Месячный оклад (basePeriod='month') начисляется по трём условиям движка (F-09-037) — здесь только
 * пояснение, само начисление считает /biz/payroll/period.
 */
import type { GuaranteedMinimumPeriod, WorkdayBlock as WorkdayBlockType, WorkdayPeriod } from '@/domain/payroll';
import { useT } from '@/i18n/useT';
import { BlockCard } from '@/areas/payroll/scheme/BlockCard';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';

export interface WorkdayBlockProps {
  value: WorkdayBlockType;
  onChange: (value: WorkdayBlockType) => void;
}

export function WorkdayBlockCard({ value, onChange }: WorkdayBlockProps) {
  const t = useT('payroll');
  const periods: { value: WorkdayPeriod; label: string }[] = [
    { value: 'hour', label: t('scheme.blocks.workday.period.hour') },
    { value: 'day', label: t('scheme.blocks.workday.period.day') },
    { value: 'month', label: t('scheme.blocks.workday.period.month') },
  ];

  return (
    <div data-f="F-09-036 F-02-096">
      <BlockCard
        dataF="F-09-036"
        title={t('scheme.blocks.workday.title')}
        description={t('scheme.blocks.workday.description')}
        enabled={value.enabled}
        onEnabledChange={(enabled) => onChange({ ...value, enabled })}
      >
        <FormField
          label={t('scheme.blocks.workday.baseLabel')}
          hint={t('scheme.blocks.workday.baseHint')}
          error={value.baseAmount < 0 || !Number.isFinite(value.baseAmount) ? t('scheme.errors.amountNegative') : undefined}
        >
          <div className="flex items-stretch gap-2">
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={value.baseAmount}
              invalid={value.baseAmount < 0}
              onChange={(e) => onChange({ ...value, baseAmount: Number(e.target.value) || 0 })}
              rightSlot={<span className="text-sm text-muted">֏</span>}
              className="min-w-0 flex-1"
            />
            <SegmentedControl
              size="sm"
              options={periods}
              value={value.basePeriod}
              onValueChange={(p) => onChange({ ...value, basePeriod: p as WorkdayPeriod })}
              aria-label={t('scheme.blocks.workday.periodAriaLabel')}
            />
          </div>
        </FormField>
        {value.basePeriod === 'month' && (
          <p data-f="F-09-037" className="text-sm text-muted">
            {t('scheme.blocks.workday.monthlyHint')}
          </p>
        )}

        <div data-f="F-09-038" className="flex flex-col gap-3 border-t border-border pt-4">
          <Checkbox
            checked={value.guaranteedMinimum.enabled}
            onCheckedChange={(enabled) => onChange({ ...value, guaranteedMinimum: { ...value.guaranteedMinimum, enabled } })}
            label={t('scheme.blocks.workday.minToggle')}
            description={t('scheme.blocks.workday.minHint')}
          />
          {value.guaranteedMinimum.enabled && (
            <FormField label={t('scheme.blocks.workday.minLabel')}>
              <div className="flex items-stretch gap-2">
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={value.guaranteedMinimum.amount}
                  onChange={(e) =>
                    onChange({ ...value, guaranteedMinimum: { ...value.guaranteedMinimum, amount: Math.max(0, Number(e.target.value) || 0) } })
                  }
                  rightSlot={<span className="text-sm text-muted">֏</span>}
                  className="min-w-0 flex-1"
                />
                <SegmentedControl
                  size="sm"
                  options={[
                    { value: 'month', label: t('scheme.blocks.workday.period.month') },
                    { value: 'day', label: t('scheme.blocks.workday.period.day') },
                  ]}
                  value={value.guaranteedMinimum.period}
                  onValueChange={(p) =>
                    onChange({ ...value, guaranteedMinimum: { ...value.guaranteedMinimum, period: p as GuaranteedMinimumPeriod } })
                  }
                  aria-label={t('scheme.blocks.workday.minPeriodAriaLabel')}
                />
              </div>
            </FormField>
          )}
        </div>
      </BlockCard>
    </div>
  );
}
