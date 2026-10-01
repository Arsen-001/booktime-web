'use client';

/**
 * Цена и длительность (У14, У15, У23): длительность — часы и минуты с шагом 5; «от–до» проверяется, «до» больше
 * «от» — иначе ошибка под полем; цена 0 — только осознанно, галочкой «Бесплатно». На телефоне «от» и «до» — друг
 * под другом, ничего не вылезает по ширине.
 */
import { useT } from '@/i18n/useT';
import { DurationInput } from '@/areas/services/components/DurationInput';
import { FIELD_IDS, type ServiceDraft, type ServiceFormErrors } from '@/areas/services/useServiceForm';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { Lock } from 'lucide-react';
import { MoneyInput } from '@/ui/MoneyInput';
import { Switch } from '@/ui/Switch';

export interface PriceDurationSectionProps {
  draft: ServiceDraft;
  set: <K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) => void;
  errors: ServiceFormErrors;
  disabled?: boolean;
  /** Сеть4: цену запретила менять сеть (F-11-082) — поля цены только для чтения, с пояснением */
  priceLocked?: boolean;
}

export function PriceDurationSection({ draft, set, errors, disabled, priceLocked = false }: PriceDurationSectionProps) {
  const tn = useT('network');
  const priceDisabled = disabled || priceLocked;
  const t = useT('services');
  const err = (k: keyof ServiceFormErrors) => (errors[k] ? t(errors[k] as never) : undefined);
  return (
    <div data-f="F-00-082 F-00-057" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Switch
          checked={draft.durationRange}
          onCheckedChange={(v) => set('durationRange', v)}
          label={t('form.durationRangeToggle')}
          disabled={disabled}
        />
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            id={FIELD_IDS.duration}
            label={draft.durationRange ? t('form.durationFrom') : t('form.durationLabel')}
            required
            error={err('duration')}
            className="min-w-0"
          >
            <DurationInput
              value={draft.durationMin}
              onValueChange={(v) => set('durationMin', v)}
              invalid={Boolean(errors.duration)}
              disabled={disabled}
            />
          </FormField>
          {draft.durationRange && (
            <FormField id={FIELD_IDS.durationMax} label={t('form.durationTo')} required error={err('durationMax')} className="min-w-0">
              <DurationInput
                value={draft.durationMax}
                onValueChange={(v) => set('durationMax', v)}
                optional
                invalid={Boolean(errors.durationMax)}
                disabled={disabled}
              />
            </FormField>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Switch
            checked={draft.priceRange}
            onCheckedChange={(v) => set('priceRange', v)}
            label={t('form.priceRangeToggle')}
            disabled={priceDisabled || draft.free}
          />
          <Checkbox checked={draft.free} onCheckedChange={(v) => set('free', v)} label={t('form.free')} disabled={priceDisabled} />
        </div>
        {priceLocked && (
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3.5 shrink-0" aria-hidden />
            {tn('extensions.serviceCard.priceLocked')}
          </p>
        )}
        {!draft.free && (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              id={FIELD_IDS.price}
              label={draft.priceRange ? t('form.priceFrom') : t('form.priceLabel')}
              required
              error={err('price')}
              className="min-w-0"
            >
              <MoneyInput
                value={draft.priceMin}
                onValueChange={(v) => set('priceMin', v)}
                invalid={Boolean(errors.price)}
                disabled={priceDisabled}
              />
            </FormField>
            {draft.priceRange && (
              <FormField id={FIELD_IDS.priceMax} label={t('form.priceTo')} required error={err('priceMax')} className="min-w-0">
                <MoneyInput
                  value={draft.priceMax}
                  onValueChange={(v) => set('priceMax', v)}
                  invalid={Boolean(errors.priceMax)}
                  disabled={priceDisabled}
                />
              </FormField>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
