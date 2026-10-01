'use client';

/** Вкладка «Для чека» формы услуги (F-07-149): название в чеке и система налогообложения — часть общего черновика */
import { useT } from '@/i18n/useT';
import type { ServiceDraft, TaxSystem } from '@/areas/services/useServiceForm';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { SectionCard } from '@/ui/SectionCard';
import { Select } from '@/ui/Select';

export interface ReceiptSectionProps {
  draft: ServiceDraft;
  set: <K extends keyof ServiceDraft>(key: K, value: ServiceDraft[K]) => void;
  disabled?: boolean;
}

export function ReceiptSection({ draft, set, disabled }: ReceiptSectionProps) {
  const t = useT('services');
  return (
    <SectionCard title={t('form.receiptTitle')} description={t('form.receiptHint')}>
      <div data-f="F-07-149" className="flex flex-col gap-4">
        <FormField label={t('form.receiptNameLabel')} optional hint={t('form.receiptNameHint')}>
          <Input
            value={draft.receiptName.ru}
            onChange={(e) => set('receiptName', { ...draft.receiptName, ru: e.target.value })}
            disabled={disabled}
          />
        </FormField>
        <FormField label={t('form.taxSystemLabel')}>
          <Select
            options={[
              { value: 'none', label: t('form.taxSystemNone') },
              { value: 'general', label: t('form.taxSystemGeneral') },
              { value: 'simplified', label: t('form.taxSystemSimplified') },
              { value: 'patent', label: t('form.taxSystemPatent') },
            ]}
            value={draft.taxSystem}
            onValueChange={(v) => set('taxSystem', v as TaxSystem)}
            disabled={disabled}
          />
        </FormField>
      </div>
    </SectionCard>
  );
}
