'use client';

/**
 * Телефон с выбором кода страны (F-04-047): по умолчанию +374 (рынок Армения), с маской по
 * последним цифрам; другой код — обычное поле цифр.
 * `src/ui/PhoneInput` рисует код страны сам (несъёмный «+374» слева), поэтому при +374 маску
 * строим здесь, своим `Input` — иначе код страны показывался бы дважды (в Select и в PhoneInput).
 * `src/ui/PhoneInput` кода страны не меняет — просьба в qa/requests/clients.md, до неё код
 * страны храним и составляем здесь, в своём компоненте.
 */
import { useState } from 'react';
import { PHONE_DIGITS, PHONE_PREFIX, formatLocalDigits } from '@/lib/phone';
import { useT } from '@/i18n/useT';
import { Input } from '@/ui/Input';
import { Select, type SelectOption } from '@/ui/Select';

const COUNTRY_CODES = ['+374', '+7', '+995', '+1', '+44'];

export interface CountryPhoneFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  invalid?: boolean;
  id?: string;
  disabled?: boolean;
}

function splitValue(value: string): { code: string; rest: string } {
  const found = COUNTRY_CODES.find((c) => value.startsWith(c));
  if (found) return { code: found, rest: value.slice(found.length) };
  if (!value) return { code: PHONE_PREFIX, rest: '' };
  return { code: PHONE_PREFIX, rest: value.replace(/^\+/, '') };
}

/** Поле «Телефон»: код страны + номер (F-04-047, F-04-048, F-04-049) */
export function CountryPhoneField({ value, onValueChange, invalid, id, disabled }: CountryPhoneFieldProps) {
  const t = useT('clients');
  const { code, rest } = splitValue(value);
  const [manualCode, setManualCode] = useState(code);

  const options: SelectOption[] = COUNTRY_CODES.map((c) => ({ value: c, label: c }));

  if (manualCode === PHONE_PREFIX) {
    const localDigits = rest.replace(/\D/g, '').slice(0, PHONE_DIGITS);
    return (
      <div className="flex items-stretch gap-2">
        <Select
          className="w-28 shrink-0"
          options={options}
          value={manualCode}
          onValueChange={(c) => {
            setManualCode(c);
            onValueChange(c === PHONE_PREFIX ? PHONE_PREFIX : `${c}${rest}`);
          }}
          aria-label={t('addClientForm.form.countryCode')}
          disabled={disabled}
        />
        <Input
          id={id}
          className="flex-1"
          type="tel"
          inputMode="tel"
          value={formatLocalDigits(localDigits)}
          invalid={invalid}
          placeholder={t('addClientForm.form.phonePlaceholderOther')}
          disabled={disabled}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, PHONE_DIGITS);
            onValueChange(digits ? `${PHONE_PREFIX}${digits}` : '');
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-2">
      <Select
        className="w-28 shrink-0"
        options={options}
        value={manualCode}
        onValueChange={(c) => {
          setManualCode(c);
          onValueChange(c === PHONE_PREFIX ? PHONE_PREFIX : `${c}${rest}`);
        }}
        aria-label={t('addClientForm.form.countryCode')}
        disabled={disabled}
      />
      <Input
        id={id}
        className="flex-1"
        type="tel"
        inputMode="tel"
        value={rest}
        invalid={invalid}
        placeholder={t('addClientForm.form.phonePlaceholderOther')}
        disabled={disabled}
        onChange={(e) => onValueChange(`${manualCode}${e.target.value.replace(/\D/g, '')}`)}
      />
    </div>
  );
}
