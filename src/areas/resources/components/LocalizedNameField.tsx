'use client';

/**
 * Название на активных языках (F-16-003): пока в работе только ru/en (docs/ADDING-A-LANGUAGE.md, CONVENTIONS §0.4) —
 * остальные языки словаря заполняются позже `npm run i18n:draft`, здесь их не спрашиваем.
 */
import { LOCALES } from '@/i18n/config';
import type { LocalizedText } from '@/domain/core';
import { FormField } from '@/ui/FormField';
import { Input } from '@/ui/Input';

export interface LocalizedNameFieldProps {
  value: LocalizedText;
  onValueChange: (value: LocalizedText) => void;
  labels: Record<string, string>;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function LocalizedNameField({ value, onValueChange, labels, error, placeholder, disabled }: LocalizedNameFieldProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {LOCALES.map((locale, i) => (
        <FormField key={locale} label={labels[locale] ?? locale} error={i === 0 ? error : undefined} required={i === 0}>
          <Input
            value={value[locale] ?? ''}
            onChange={(e) => onValueChange({ ...value, [locale]: e.target.value })}
            placeholder={placeholder}
            maxLength={60}
            disabled={disabled}
          />
        </FormField>
      ))}
    </div>
  );
}
