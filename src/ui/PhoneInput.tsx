'use client';

import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/cn';
import { PHONE_DIGITS, PHONE_PREFIX, formatLocalDigits } from '@/lib/phone';
import { useT } from '@/i18n/useT';
import { FIELD_BORDER, FIELD_HEIGHT, type FieldSize } from '@/ui/Input';
import { useControllableState } from '@/ui/hooks/useControllableState';

/** '+37400123' → '00123'; любые нецифры отбрасываются */
function digitsOf(value: string): string {
  const raw = value.startsWith(PHONE_PREFIX) ? value.slice(PHONE_PREFIX.length) : value;
  return raw.replace(/\D/g, '').slice(0, PHONE_DIGITS);
}

export interface PhoneInputProps extends Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'size' | 'type'
> {
  /** '+374' + до 8 цифр (частичный ввод тоже), '' — пусто */
  value?: string;
  defaultValue?: string;
  /**
   * value — '+374' + цифры; meta.localDigits — только введённые цифры без кода страны.
   * Для ПОИСКА по номеру используйте localDigits (поиск «по последним цифрам»), а не value.
   */
  onValueChange?: (value: string, meta: { localDigits: string }) => void;
  invalid?: boolean;
  size?: FieldSize;
}

/**
 * Телефон Армении: префикс «+374» не редактируется, маска «XX XXX XXX».
 * Отдаёт '+374' + введённые цифры (или '' если пусто). Проверка полноты — normalizePhone() из '@/lib/phone'.
 */
export function PhoneInput({
  value,
  defaultValue = '',
  onValueChange,
  invalid = false,
  size = 'md',
  placeholder,
  disabled,
  className,
  ...rest
}: PhoneInputProps) {
  const t = useT('ui');
  const [current, setCurrent] = useControllableState(value, defaultValue, (next: string) =>
    onValueChange?.(next, { localDigits: digitsOf(next) }),
  );
  const display = formatLocalDigits(digitsOf(current));

  const handleChange = (text: string) => {
    let digits = text.replace(/\D/g, '');
    // Вставили номер целиком: «+374 00 123 456» или «00 123 456»
    if (digits.length > PHONE_DIGITS && digits.startsWith('374')) digits = digits.slice(3);
    digits = digits.slice(0, PHONE_DIGITS);
    setCurrent(digits ? `${PHONE_PREFIX}${digits}` : '');
  };

  return (
    <div
      className={cn(
        'flex w-full items-stretch overflow-hidden rounded-xl border bg-surface shadow-xs transition-[border-color,box-shadow] duration-150',
        'focus-within:border-primary focus-within:shadow-none focus-within:ring-4 focus-within:ring-focus/15',
        FIELD_BORDER[invalid ? 'invalid' : 'normal'],
        invalid && 'focus-within:border-danger focus-within:ring-danger/15',
        FIELD_HEIGHT[size],
        disabled && 'bg-surface-2',
        className,
      )}
    >
      <span
        className="flex shrink-0 items-center border-r border-border bg-surface-2 px-3.5 text-base font-medium text-muted"
        aria-label={t('phone.countryCode')}
      >
        {PHONE_PREFIX}
      </span>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={display}
        placeholder={placeholder ?? t('phone.placeholder')}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => handleChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent px-3.5 text-base tracking-wide text-fg placeholder:text-muted/80 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-muted"
        {...rest}
      />
    </div>
  );
}
