'use client';

/**
 * F-13-028: регистрация «Аккаунта разработчика» — одной формой. Кабинет виден только тому, кто его завёл
 * (ownerStaffId в api/integrations.ts), поэтому форма не спрашивает бизнес — он берётся из текущего актёра.
 */
import { useState } from 'react';
import { registerDeveloper } from '@/api/integrations';
import { useApiMutation } from '@/api/request';
import { useT } from '@/i18n/useT';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/Checkbox';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { PhoneInput } from '@/ui/PhoneInput';
import { SectionCard } from '@/ui/SectionCard';
import { Textarea } from '@/ui/Textarea';
import { useToast } from '@/ui/Toast';

interface FormState {
  companyName: string;
  purpose: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contactWebsite: string;
  partnerBearer: string;
}

const EMPTY: FormState = { companyName: '', purpose: '', contactName: '', contactPhone: '', contactEmail: '', contactWebsite: '', partnerBearer: '' };

export function DeveloperRegisterForm({ onRegistered }: { onRegistered: () => void }) {
  const t = useT('integrations');
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const mutation = useApiMutation(registerDeveloper);

  const set = <K extends keyof FormState>(key: K) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.companyName.trim()) next.companyName = t('developers.register.required');
    if (!form.purpose.trim()) next.purpose = t('developers.register.required');
    if (!form.contactName.trim()) next.contactName = t('developers.register.required');
    if (!form.contactEmail.trim()) next.contactEmail = t('developers.register.required');
    setErrors(next);
    if (Object.keys(next).length > 0 || !agree) return;
    try {
      await mutation.mutate({
        companyName: form.companyName.trim(),
        purpose: form.purpose.trim(),
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim(),
        contactWebsite: form.contactWebsite.trim() || undefined,
        partnerBearer: form.partnerBearer.trim() || undefined,
      });
      toast.success(t('developers.register.done'));
      onRegistered();
    } catch {
      toast.error(t('errors.actionFailed'));
    }
  };

  return (
    <div data-f="F-13-028" className="flex flex-col gap-4">
      <SectionCard title={t('developers.register.aboutTitle')} description={t('developers.register.aboutHint')}>
        <div className="flex flex-col gap-4">
          <FormField label={t('developers.register.companyName')} required error={errors.companyName}>
            <Input value={form.companyName} onChange={(e) => set('companyName')(e.target.value)} placeholder={t('developers.register.companyNamePlaceholder')} />
          </FormField>
          <FormField label={t('developers.register.purpose')} required error={errors.purpose}>
            <Textarea value={form.purpose} onChange={(e) => set('purpose')(e.target.value)} rows={3} placeholder={t('developers.register.purposePlaceholder')} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('developers.register.contactsTitle')} description={t('developers.register.contactsHint')}>
        <div className="flex flex-col gap-4">
          <FormField label={t('developers.register.contactName')} required error={errors.contactName}>
            <Input value={form.contactName} onChange={(e) => set('contactName')(e.target.value)} />
          </FormField>
          <FormField label={t('developers.register.contactPhone')} optional>
            <PhoneInput value={form.contactPhone} onValueChange={(next) => set('contactPhone')(next)} />
          </FormField>
          <FormField label={t('developers.register.contactEmail')} required error={errors.contactEmail}>
            <Input type="email" value={form.contactEmail} onChange={(e) => set('contactEmail')(e.target.value)} />
          </FormField>
          <FormField label={t('developers.register.contactWebsite')} optional>
            <Input value={form.contactWebsite} onChange={(e) => set('contactWebsite')(e.target.value)} placeholder="https://" />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard title={t('developers.register.bearerTitle')} description={t('developers.register.bearerHint')}>
        <FormField label={t('developers.register.bearerLabel')} optional>
          <Input value={form.partnerBearer} onChange={(e) => set('partnerBearer')(e.target.value)} className="font-mono" />
        </FormField>
      </SectionCard>

      <Checkbox checked={agree} onCheckedChange={setAgree} label={t('developers.register.agree')} />

      <Button loading={mutation.isPending} onClick={submit} className="self-start" disabled={!agree}>
        {t('developers.register.submit')}
      </Button>
    </div>
  );
}
