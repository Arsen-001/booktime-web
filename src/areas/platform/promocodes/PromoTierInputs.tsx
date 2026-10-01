'use client';

/** Ступени скидки: 1 / 3 / 6 / 12 месяцев, проценты с «%» внутри поля (F-00-020: 10–25%, 0% — только за 1 месяц). */
import type { PromoMonths } from '@/domain/platform';
import { clampTierPercent } from '@/domain/platform';
import { useT } from '@/i18n/useT';
import { Input } from '@/ui/Input';

export const TIER_MONTHS: PromoMonths[] = [1, 3, 6, 12];

export function PromoTierInputs({ value, onChange }: { value: Record<PromoMonths, number>; onChange: (v: Record<PromoMonths, number>) => void }) {
  const t = useT('platform');
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {TIER_MONTHS.map((m) => (
        <label key={m} className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t('promocodes.tierMonths', { n: m })}</span>
          <Input
            inputMode="numeric"
            value={String(value[m])}
            onChange={(e) => onChange({ ...value, [m]: Number(e.target.value.replace(/\D/g, '') || 0) })}
            onBlur={() => onChange({ ...value, [m]: clampTierPercent(m, value[m]) })}
            rightSlot={<span className="px-3 text-muted">%</span>}
            aria-label={t('promocodes.tierAria', { n: m })}
          />
        </label>
      ))}
    </div>
  );
}
