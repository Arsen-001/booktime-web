'use client';

/**
 * Название на языках клиентской части (F-16-003): армянский, русский, английский — как у услуг (проход кабинета
 * 17.11.2026: ресурс и пакет спрашивали только RU/EN, а клиент на армянской странице видел русское название).
 * Обязателен русский — он же запасной для языка без перевода.
 */
import { CLIENT_LOCALES } from '@/i18n/config';
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
    <div className="grid gap-5 sm:grid-cols-3">
      {CLIENT_LOCALES.map((locale) => (
        <FormField key={locale} label={labels[locale] ?? locale} error={locale === 'ru' ? error : undefined} required={locale === 'ru'}>
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
