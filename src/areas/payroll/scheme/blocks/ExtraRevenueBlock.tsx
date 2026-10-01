'use client';

/**
 * Блок «Дополнительное вознаграждение за оказанные услуги / за продажу товаров» (F-09-042, F-09-043).
 * Принадлежит разделу «payroll». Один компонент — оба блока отличаются только заголовком.
 */
import type { ExtraRevenueBase, ExtraRevenueBlock as ExtraRevenueBlockType } from '@/domain/payroll';
import { useT } from '@/i18n/useT';
import { BlockCard } from '@/areas/payroll/scheme/BlockCard';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';

export interface ExtraRevenueBlockProps {
  kind: 'services' | 'products';
  value: ExtraRevenueBlockType;
  onChange: (value: ExtraRevenueBlockType) => void;
}

export function ExtraRevenueBlockCard({ kind, value, onChange }: ExtraRevenueBlockProps) {
  const t = useT('payroll');
  const bases: { value: ExtraRevenueBase; label: string }[] = [
    { value: 'turnover', label: t('scheme.blocks.extraRevenue.base.turnover') },
    { value: 'profit', label: t('scheme.blocks.extraRevenue.base.profit') },
  ];
  return (
    <div data-f={kind === 'services' ? 'F-09-042' : 'F-09-043'}>
      {/* data-f="F-09-042" data-f="F-09-043 F-08-126" — литералы для scripts/fids.mjs, значение задаёт ветка выше */}
      <BlockCard
        dataF={kind === 'services' ? 'F-09-042' : 'F-09-043'}
        title={t(`scheme.blocks.extraRevenue.${kind}.title`)}
        description={t(`scheme.blocks.extraRevenue.${kind}.description`)}
        enabled={value.enabled}
        onEnabledChange={(enabled) => onChange({ ...value, enabled })}
      >
        <FormField
          label={t('scheme.blocks.extraRevenue.percentLabel')}
          error={value.percent < 0 || value.percent > 100 ? t('scheme.errors.percentRange') : undefined}
        >
          <div className="flex items-stretch gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              inputMode="decimal"
              value={value.percent}
              invalid={value.percent < 0 || value.percent > 100}
              onChange={(e) => onChange({ ...value, percent: Number(e.target.value) || 0 })}
              rightSlot={<span className="text-sm text-muted">%</span>}
              className="min-w-0 flex-1"
            />
            <SegmentedControl
              size="sm"
              options={bases}
              value={value.base}
              onValueChange={(b) => onChange({ ...value, base: b as ExtraRevenueBase })}
              aria-label={t('scheme.blocks.extraRevenue.baseAriaLabel')}
            />
          </div>
        </FormField>
      </BlockCard>
    </div>
  );
}
