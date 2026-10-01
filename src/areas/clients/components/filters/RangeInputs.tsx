'use client';

/** Пара «от — до»: суммы (֏) или числа (визиты, возраст). Подсказки «от»/«до» внутри полей, знак ֏ — один раз в поле */
import type { NumberRangeValue } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { Input } from '@/ui/Input';
import { MoneyInput } from '@/ui/MoneyInput';

export interface RangeInputsProps {
  value?: NumberRangeValue;
  onChange: (v?: NumberRangeValue) => void;
  /** money — суммы в ֏; count — целые числа */
  kind?: 'money' | 'count';
}

export function RangeInputs({ value, onChange, kind = 'money' }: RangeInputsProps) {
  const t = useT('clients');
  const next = (patch: NumberRangeValue) => {
    const merged = { ...value, ...patch };
    onChange(merged.from === undefined && merged.to === undefined ? undefined : merged);
  };
  const num = (raw: string) => (raw === '' ? undefined : Math.max(0, Math.round(Number(raw))));
  return (
    <div className="grid grid-cols-2 gap-2">
      {kind === 'money' ? (
        <>
          <MoneyInput value={value?.from} onValueChange={(from) => next({ from })} placeholder={t('filters.from')} aria-label={t('filters.from')} />
          <MoneyInput value={value?.to} onValueChange={(to) => next({ to })} placeholder={t('filters.to')} aria-label={t('filters.to')} />
        </>
      ) : (
        <>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={value?.from ?? ''}
            onChange={(e) => next({ from: num(e.target.value) })}
            placeholder={t('filters.from')}
            aria-label={t('filters.from')}
          />
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            value={value?.to ?? ''}
            onChange={(e) => next({ to: num(e.target.value) })}
            placeholder={t('filters.to')}
            aria-label={t('filters.to')}
          />
        </>
      )}
    </div>
  );
}
