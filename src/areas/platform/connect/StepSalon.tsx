'use client';

/** Шаг «Салон»: тип, название, сфера (чипами, одно касание), владелец и его телефон — по нему он войдёт. */
import type { ConnectForm, StepErrors } from '@/areas/platform/connect/connectForm';
import { SPHERE_IDS } from '@/config/spheres';
import type { BusinessKind, SphereId } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { Chip } from '@/ui/Chip';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { SegmentedControl } from '@/ui/SegmentedControl';

interface StepSalonProps {
  form: ConnectForm;
  errors: StepErrors;
  onChange: (patch: Partial<ConnectForm>) => void;
}

export function StepSalon({ form, errors, onChange }: StepSalonProps) {
  const t = useT('platform');
  const tc = useT('common');
  return (
    <div className="flex flex-col gap-5">
      <FormField label={t('connect.kind')}>
        <SegmentedControl
          fullWidth
          value={form.kind}
          onValueChange={(v) => onChange({ kind: v as BusinessKind })}
          options={[
            { value: 'salon', label: t('connect.kindSalon') },
            { value: 'individual', label: t('connect.kindIndividual') },
          ]}
        />
      </FormField>
      <FormField label={t('connect.name')} required error={errors.name ? t('connect.issue.name') : undefined}>
        <Input value={form.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={t('connect.namePlaceholder')} autoComplete="organization" />
      </FormField>
      <FormField label={t('connect.sphere')} required error={errors.sphere ? t('connect.issue.sphere') : undefined} hint={t('connect.sphereHint')}>
        <div role="radiogroup" aria-label={t('connect.sphere')} className="flex flex-wrap gap-2">
          {SPHERE_IDS.map((s) => (
            <Chip key={s} selected={form.sphereId === s} onClick={() => onChange({ sphereId: s as SphereId })}>
              {tc(`spheres.${s}`)}
            </Chip>
          ))}
        </div>
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label={t('connect.ownerPhone')} required error={errors.ownerPhone ? t('connect.issue.ownerPhone') : undefined} hint={t('connect.ownerPhoneHint')}>
          <PhoneInput value={form.ownerPhone} onValueChange={(v) => onChange({ ownerPhone: v })} />
        </FormField>
        <FormField label={t('connect.ownerName')} optional>
          <Input value={form.ownerName} onChange={(e) => onChange({ ownerName: e.target.value })} autoComplete="name" />
        </FormField>
      </div>
    </div>
  );
}
