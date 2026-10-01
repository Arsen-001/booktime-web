'use client';

import type { CustomClientField } from '@/domain/online';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';
import { Select } from '@/ui/Select';

/** Одно поле экрана данных клиента (F-03-073) или сети (F-03-074) — общая разметка для обоих */
export function CustomFieldInput({
  field,
  value,
  onChange,
  datePlaceholder,
}: {
  field: CustomClientField;
  value: string;
  onChange: (v: string) => void;
  datePlaceholder: string;
}) {
  return (
    <FormField label={field.label} required={field.required} optional={!field.required}>
      {field.type === 'select' ? (
        <Select value={value} onValueChange={onChange} options={(field.options ?? []).map((o) => ({ value: o, label: o }))} />
      ) : (
        <Input
          type={field.type === 'number' ? 'number' : 'text'}
          placeholder={field.type === 'date' ? datePlaceholder : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FormField>
  );
}
