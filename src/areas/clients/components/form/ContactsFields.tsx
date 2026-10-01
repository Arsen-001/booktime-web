'use client';

/** Форма клиента, «Контакты»: имя, ФИО по настройке, телефон с кодом страны, второй телефон, email (F-04-045…050) */
import type { ClientDraft } from '@/areas/clients/components/ClientFormFields';
import { CountryPhoneField } from '@/areas/clients/components/CountryPhoneField';
import type { PreferredContact } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';

export interface ContactsFieldsProps {
  draft: ClientDraft;
  onChange: (patch: Partial<ClientDraft>) => void;
  errors?: Partial<Record<'name' | 'phone', string>>;
  showFullName: boolean;
  /** main — имя и телефон (короткая форма «Добавить»); extra — ФИО, второй телефон, email («Ещё о клиенте»); all — всё */
  part: 'main' | 'extra' | 'all';
  canEditGeneral: boolean;
  canEditFullName: boolean;
}

export function ContactsFields({ draft, onChange, errors, showFullName, part, canEditGeneral, canEditFullName }: ContactsFieldsProps) {
  const t = useT('clients');
  const main = part !== 'extra';
  const extra = part !== 'main';
  return (
    <div className="flex flex-col gap-4">
      <div data-f="F-04-045" className="grid grid-cols-1 gap-4 @lg:grid-cols-2 empty:hidden">
        {main && (
          <FormField label={t('addClientForm.form.name')} required error={errors?.name} className="@lg:col-span-2">
            <Input
              value={draft.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder={t('addClientForm.form.namePlaceholder')}
              autoComplete="off"
              disabled={!canEditGeneral}
            />
          </FormField>
        )}
        {showFullName && extra && (
          <>
            <FormField label={t('addClientForm.form.lastName')}>
              <Input value={draft.lastName} onChange={(e) => onChange({ lastName: e.target.value })} disabled={!canEditFullName} />
            </FormField>
            <FormField label={t('addClientForm.form.middleName')}>
              <Input value={draft.middleName} onChange={(e) => onChange({ middleName: e.target.value })} disabled={!canEditFullName} />
            </FormField>
          </>
        )}
      </div>
      {main && (
        <div data-f="F-04-047 F-04-048 F-04-049">
          <FormField label={t('addClientForm.form.phone')} required error={errors?.phone}>
            <CountryPhoneField value={draft.phone} onValueChange={(phone) => onChange({ phone })} invalid={Boolean(errors?.phone)} disabled={!canEditGeneral} />
          </FormField>
        </div>
      )}
      {extra && (
        <>
          <div data-f="F-04-050">
            <FormField label={t('addClientForm.form.additionalPhone')}>
              <CountryPhoneField value={draft.additionalPhone} onValueChange={(additionalPhone) => onChange({ additionalPhone })} disabled={!canEditGeneral} />
            </FormField>
          </div>
          <FormField label={t('addClientForm.form.email')}>
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder={t('addClientForm.form.emailPlaceholder')}
              disabled={!canEditGeneral}
            />
          </FormField>
          <div data-f="F-04-066" className="@lg:col-span-2">
            <FormField label={t('addClientForm.form.preferredContact')} hint={t('addClientForm.form.preferredContactHint')}>
              <SegmentedControl
                fullWidth
                value={draft.preferredContact}
                onValueChange={(v) => onChange({ preferredContact: v as PreferredContact })}
                options={[
                  { value: 'call', label: t('addClientForm.form.preferredContactCall') },
                  { value: 'wa', label: 'WhatsApp' },
                  { value: 'tg', label: 'Telegram' },
                  { value: 'viber', label: 'Viber' },
                ]}
              />
            </FormField>
          </div>
        </>
      )}
    </div>
  );
}
