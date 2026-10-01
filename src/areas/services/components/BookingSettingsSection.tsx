'use client';

/**
 * Настройки записи: технический перерыв (тот же набор, что в меню строки списка — 5 мин … 1 ч, шаг 5, У9),
 * напоминание «пора снова» и выбор оттенка. Переключатели на узком экране растягиваются и переносят подписи (У16).
 */
import { useSphere } from '@/demo/hooks';
import type { TechBreakMode } from '@/domain/services';
import { useT } from '@/i18n/useT';
import { TECH_BREAK_MINUTES } from '@/areas/services/components/techBreak';
import type { ServiceDraft } from '@/areas/services/useServiceForm';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { Select } from '@/ui/Select';

/** Сегменты на узком экране: во всю ширину, подпись переносится, а не обрезается (У16) */
export const WRAP_SEGMENTS =
  'max-sm:[&>button]:min-w-0 max-sm:[&>button]:shrink max-sm:[&>button]:whitespace-normal max-sm:[&>button]:py-1.5 max-sm:[&>button]:leading-tight';

export interface BookingSettingsSectionProps {
  draft: ServiceDraft;
  set: <K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) => void;
  disabled?: boolean;
}

export function BookingSettingsSection({ draft, set, disabled }: BookingSettingsSectionProps) {
  const t = useT('services');
  const sphere = useSphere();
  return (
    <div data-f="F-02-060 F-00-084 F-00-094" className="flex flex-col gap-4">
      <FormField label={t('techBreak.label')} hint={t('techBreak.hint')}>
        <SegmentedControl
          fullWidth
          className={WRAP_SEGMENTS}
          options={[
            { value: 'shared', label: t('techBreak.shared') },
            { value: 'none', label: t('techBreak.none') },
            { value: 'custom', label: t('techBreak.custom') },
          ]}
          value={draft.techBreak}
          onValueChange={(v) => set('techBreak', v as TechBreakMode)}
        />
      </FormField>
      {draft.techBreak === 'custom' && (
        <FormField label={t('techBreak.customLabel')}>
          <Select
            options={TECH_BREAK_MINUTES.map((n) => ({
              value: String(n),
              label: t('techBreak.minutes', { n }),
            }))}
            value={String(draft.techBreakMin)}
            onValueChange={(v) => set('techBreakMin', Number(v))}
            disabled={disabled}
          />
        </FormField>
      )}
      <FormField label={t('form.repeatLabel')} optional hint={t('form.repeatHint')}>
        <Input
          type="text"
          inputMode="numeric"
          value={draft.repeatDays ?? ''}
          onChange={(e) => set('repeatDays', Number(e.target.value.replace(/\D/g, '')) || undefined)}
          disabled={disabled}
        />
      </FormField>
      <FormField
        label={t('form.shadeChoiceLabel')}
        hint={sphere.has('palette') ? t('form.shadeChoicePaletteHint') : t('form.shadeChoiceManualHint')}
      >
        <SegmentedControl
          fullWidth
          className={WRAP_SEGMENTS}
          options={[
            { value: 'off', label: t('form.shadeChoiceOff') },
            { value: 'preferred', label: t('form.shadeChoicePreferred') },
            { value: 'required', label: t('form.shadeChoiceRequired') },
          ]}
          value={draft.shadeChoice}
          onValueChange={(v) => set('shadeChoice', v as ServiceDraft['shadeChoice'])}
        />
      </FormField>
    </div>
  );
}
