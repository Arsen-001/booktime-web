'use client';

/**
 * Поле «число + единица (% / դր)» — ставка личных услуг, товаров, доп. вознаграждения (F-09-014, F-09-031).
 * Принадлежит разделу «payroll».
 */
import type { ReactNode } from 'react';
import { checkPayoutValue, type PayoutUnit, type PayoutValue } from '@/domain/payroll';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';

export interface PayoutValueFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  value: PayoutValue;
  onValueChange: (value: PayoutValue) => void;
  /** Скрыть выбор «сумма» — только процент (не используется сейчас, оставлено для будущих блоков) */
  amountAllowed?: boolean;
  id?: string;
}

export function PayoutValueField({ label, hint, value, onValueChange, amountAllowed = true, id }: PayoutValueFieldProps) {
  const t = useT('payroll');
  const check = checkPayoutValue(value);
  const units: { value: PayoutUnit; label: string }[] = [
    { value: 'percent', label: t('scheme.unit.percent') },
    ...(amountAllowed ? [{ value: 'amount' as PayoutUnit, label: t('scheme.unit.amount') }] : []),
  ];

  return (
    <FormField
      label={label}
      hint={hint}
      error={!check.valid && check.reasonKey ? t(`scheme.errors.${check.reasonKey}`) : undefined}
      id={id}
    >
      {/* F-09-014: в узком контейнере (вкладка карточки сотрудника) число и переключатель единиц в
          одну строку не помещались без сжатия — flex-wrap переносит переключатель на свою строку
          вместо того, чтобы сжимать оба элемента ниже 40px */}
      <div className="flex flex-wrap items-stretch gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          value={Number.isFinite(value.value) ? value.value : ''}
          invalid={!check.valid}
          onChange={(e) => onValueChange({ ...value, value: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
          className="min-w-[120px] flex-1"
        />
        <SegmentedControl
          size="sm"
          options={units}
          value={value.unit}
          onValueChange={(u) => onValueChange({ ...value, unit: u as PayoutUnit })}
          aria-label={t('scheme.unitAriaLabel')}
          /* Сегменты «%»/«դր» — короткие подписи ужимали кнопку у́же 40px по ширине (контент сам по
             себе ~36px, shrink-0 не растягивает). fullWidth делит контейнер поровну между сегментами,
             min-w держит итог ≥40px на сегмент даже при двух вариантах. */
          fullWidth
          className="min-w-[100px] flex-1"
        />
      </div>
    </FormField>
  );
}
