'use client';

/** Форма клиента, «О клиенте»: день рождения, пол, категории, примечание, язык, национальный номер, поздравления */
import type { ClientDraft } from '@/areas/clients/components/ClientFormFields';
import { CategoryTagInput } from '@/areas/clients/components/CategoryTagInput';
import type { Gender } from '@/domain/core';
import { useT } from '@/i18n/useT';
import { today } from '@/lib/date';
import { DatePicker } from '@/ui/DatePicker';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Select, type SelectOption } from '@/ui/Select';
import { Switch } from '@/ui/Switch';
import { Textarea } from '@/ui/Textarea';

export interface AboutFieldsProps {
  draft: ClientDraft;
  onChange: (patch: Partial<ClientDraft>) => void;
  categoryOptions: string[];
  hasApp: boolean;
  canEditGeneral: boolean;
  canEditNote: boolean;
}

export function AboutFields({ draft, onChange, categoryOptions, hasApp, canEditGeneral, canEditNote }: AboutFieldsProps) {
  const t = useT('clients');
  const tc = useT('common');
  const genderOptions: SelectOption[] = [
    { value: 'unset', label: tc('gender.unknown') },
    { value: 'female', label: tc('gender.female') },
    { value: 'male', label: tc('gender.male') },
  ];
  const localeOptions: SelectOption[] = [
    { value: 'unset', label: t('form.localeUnset') },
    { value: 'ru', label: t('form.localeRu') },
    { value: 'en', label: t('form.localeEn') },
    { value: 'hy', label: t('form.localeHy') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div data-f="F-04-051 F-04-052" className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <FormField label={t('addClientForm.form.birthday')}>
          <DatePicker
            value={draft.birthday || null}
            onValueChange={(d) => onChange({ birthday: d ?? '' })}
            clearable
            max={today()}
            disabled={!canEditGeneral}
          />
        </FormField>
        <FormField label={t('addClientForm.form.gender')}>
          <Select
            options={genderOptions}
            value={draft.gender}
            onValueChange={(g) => onChange({ gender: g as Gender | 'unset' })}
            disabled={!canEditGeneral}
          />
        </FormField>
      </div>
      <div data-f="F-04-058 F-04-111" className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-fg">{t('addClientForm.form.categories')}</span>
        <CategoryTagInput
          value={draft.tags}
          onValueChange={(tags) => onChange({ tags })}
          suggestions={categoryOptions}
          placeholder={t('addClientForm.form.categoriesPlaceholder')}
          disabled={!canEditGeneral}
        />
      </div>
      <div data-f="F-04-057">
        <FormField label={t('form.note')} hint={t('form.noteHint')}>
          <Textarea
            value={draft.note}
            onChange={(e) => onChange({ note: e.target.value })}
            rows={3}
            placeholder={canEditNote ? t('addClientForm.form.notePlaceholder') : t('card.editForbidden')}
            disabled={!canEditNote}
          />
        </FormField>
      </div>
      <div data-f="F-04-192 F-04-228" className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        {!hasApp && (
          <FormField label={t('form.clientLocale')} hint={t('form.clientLocaleHint')}>
            <Select
              options={localeOptions}
              value={draft.locale}
              onValueChange={(v) => onChange({ locale: v as ClientDraft['locale'] })}
              disabled={!canEditGeneral}
            />
          </FormField>
        )}
        <FormField label={t('form.nationalId')} hint={t('form.nationalIdHint')}>
          <Input
            value={draft.nationalId}
            onChange={(e) => onChange({ nationalId: e.target.value.replace(/\D/g, '').slice(0, 12) })}
            placeholder="000000000000"
            inputMode="numeric"
            disabled={!canEditGeneral}
          />
        </FormField>
      </div>
      <div data-f="F-04-213 F-14-101 F-14-178">
        <Switch
          checked={!draft.birthdayGreetingOptOut}
          onCheckedChange={(v) => onChange({ birthdayGreetingOptOut: !v })}
          label={t('form.birthdayGreeting')}
          description={t('form.birthdayGreetingHint')}
          disabled={!canEditGeneral}
        />
      </div>
    </div>
  );
}
