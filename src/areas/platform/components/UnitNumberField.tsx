'use client';

/** Число с единицей внутри поля («2 000 монет», «30 %»): только цифры, без системных стрелок. */
import type { ReactNode } from 'react';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';

interface UnitNumberFieldProps {
  label: ReactNode;
  value: number;
  unit: string;
  hint?: ReactNode;
  onChange: (n: number) => void;
}

export function UnitNumberField({ label, value, unit, hint, onChange }: UnitNumberFieldProps) {
  return (
    <FormField label={label} hint={hint}>
      <Input
        inputMode="numeric"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '') || 0))}
        rightSlot={<span className="px-3 text-muted">{unit}</span>}
      />
    </FormField>
  );
}
