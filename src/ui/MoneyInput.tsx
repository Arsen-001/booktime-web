'use client';

import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/cn';
import { AMD, formatNumber } from '@/lib/money';
import { useT } from '@/i18n/useT';
import { FIELD_BORDER, FIELD_HEIGHT, type FieldSize } from '@/ui/Input';
import { useControllableState } from '@/ui/hooks/useControllableState';

export interface MoneyInputProps extends Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'size' | 'type' | 'min' | 'max'
> {
  /** Сумма в драмах; undefined — пусто. Чтобы очистить управляемое поле, передайте value={undefined} явно */
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number | undefined) => void;
  /** Подсказка браузеру/проверке; при вводе значение не обрезается */
  min?: number;
  max?: number;
  invalid?: boolean;
  size?: FieldSize;
}

/** Потолок суммы в поле: 999 999 999 ֏ — больше не набрать (fin-review Ф3: было 999 999 999 999) */
export const MONEY_INPUT_LIMIT = 999_999_999;

/**
 * Текст поля → целые драмы (fin-review Ф3). Драм без копеек: дробная часть после точки/запятой отбрасывается
 * («1500.75» → 1500, «1500,5» → 1500), а не склеивается с целой («1500.75» было 150 075). Точка или запятая,
 * за которой ровно три цифры и дальше снова разряды или конец («1,500», «12.500.000»), — разделитель разрядов.
 * Сумма выше потолка — undefined (поле оставит прежнее значение).
 */
export function parseMoneyInput(text: string): number | undefined | null {
  const cleaned = text.replace(/[\s  ']/g, '');
  // Разделители разрядов: [.,] + ровно 3 цифры, дальше — ещё разделитель или конец строки
  const grouped = cleaned.replace(/[.,](?=\d{3}(?:[.,]|$))/g, '');
  const intPart = grouped.split(/[.,]/)[0] ?? '';
  const digits = intPart.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return undefined;
  const value = Number(digits);
  if (!Number.isSafeInteger(value) || value > MONEY_INPUT_LIMIT) return null;
  return value;
}

/** Сумма в драмах: разряды «5 000», суффикс «֏», цифровая клавиатура на телефоне */
export function MoneyInput(props: MoneyInputProps) {
  const {
    value,
    defaultValue,
    onValueChange,
    min,
    max,
    invalid = false,
    size = 'md',
    placeholder,
    disabled,
    className,
    ...rest
  } = props;
  const t = useT('ui');
  const controlled = Object.prototype.hasOwnProperty.call(props, 'value');
  const [current, setCurrent] = useControllableState<number | undefined>(
    value,
    defaultValue,
    onValueChange,
    controlled,
  );
  const outOfRange =
    current !== undefined && ((min !== undefined && current < min) || (max !== undefined && current > max));
  const isInvalid = invalid || outOfRange;

  return (
    <div
      className={cn(
        'flex w-full items-stretch overflow-hidden rounded-xl border bg-surface shadow-xs transition-[border-color,box-shadow] duration-150',
        'focus-within:border-primary focus-within:shadow-none focus-within:ring-4 focus-within:ring-focus/15',
        FIELD_BORDER[isInvalid ? 'invalid' : 'normal'],
        isInvalid && 'focus-within:border-danger focus-within:ring-danger/15',
        FIELD_HEIGHT[size],
        disabled && 'bg-surface-2',
        className,
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={current === undefined ? '' : formatNumber(current)}
        placeholder={placeholder ?? t('money.placeholder')}
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        onChange={(e) => {
          const next = parseMoneyInput(e.target.value);
          // null — выше потолка: не принимаем нажатие, в поле остаётся прежняя сумма
          if (next === null) return;
          setCurrent(next);
        }}
        className="min-w-0 flex-1 bg-transparent px-3.5 text-right text-base tabular-nums text-fg placeholder:text-muted/80 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-muted"
        {...rest}
      />
      <span className="flex shrink-0 items-center pr-3.5 text-base font-medium text-muted">
        <span aria-hidden>{AMD}</span>
        <span className="sr-only">{t('money.currency')}</span>
      </span>
    </div>
  );
}
