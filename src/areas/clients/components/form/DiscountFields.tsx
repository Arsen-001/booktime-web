'use client';

/** Форма клиента, «Скидка и уровень»: уровень важности и скидка в паре, номер карты, запрет онлайн-записи (F-04-053…056) */
import type { ClientDraft } from '@/areas/clients/components/ClientFormFields';
import { IMPORTANCE_CLASSES, type ImportanceClass } from '@/domain/clients';
import { useT } from '@/i18n/useT';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Select, type SelectOption } from '@/ui/Select';
import { Switch } from '@/ui/Switch';

export interface DiscountFieldsProps {
  draft: ClientDraft;
  onChange: (patch: Partial<ClientDraft>) => void;
  canEditGeneral: boolean;
}

export function DiscountFields({ draft, onChange, canEditGeneral }: DiscountFieldsProps) {
  const t = useT('clients');
  const importanceOptions: SelectOption[] = [
    { value: 'none', label: t('importance.none') },
    ...IMPORTANCE_CLASSES.map((c) => ({ value: c, label: t(`importance.${c}`) })),
  ];
  return (
    <div className="flex flex-col gap-4">
      <div data-f="F-04-053 F-04-055 F-06-007" className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
        <FormField label={t('addClientForm.form.importance')}>
          <Select
            options={importanceOptions}
            value={draft.importanceClass}
            onValueChange={(v) => onChange({ importanceClass: v as ImportanceClass | 'none' })}
            disabled={!canEditGeneral}
          />
        </FormField>
        <FormField label={t('addClientForm.form.discount')}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={draft.discountPercent ?? ''}
            onChange={(e) => onChange({ discountPercent: e.target.value === '' ? undefined : Math.min(100, Math.max(0, Number(e.target.value))) })}
            rightSlot={<span className="text-sm text-muted">%</span>}
            placeholder="0"
            disabled={!canEditGeneral}
          />
        </FormField>
      </div>
      <div data-f="F-04-054 F-06-006 F-06-018">
        <FormField label={t('form.cardNumber')}>
          <Input
            value={draft.cardNumber}
            onChange={(e) => onChange({ cardNumber: e.target.value })}
            placeholder="000 000 000"
            disabled={!canEditGeneral}
          />
        </FormField>
      </div>
      <div data-f="F-04-056 F-00-189">
        <Switch
          checked={draft.blocked}
          onCheckedChange={(blocked) => onChange({ blocked })}
          label={t('form.blacklisted')}
          description={t('addClientForm.form.blacklistedHint')}
          disabled={!canEditGeneral}
        />
      </div>
    </div>
  );
}
