'use client';

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';
import { FIELD_BASE, FIELD_BORDER, FIELD_HEIGHT, type FieldSize } from '@/ui/Input';

export interface SearchInputProps extends Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'size' | 'type'
> {
  value?: string;
  defaultValue?: string;
  /** Вызывается с текстом поиска (с задержкой debounceMs, если задана) */
  onValueChange?: (value: string) => void;
  /** Задержка вызова onValueChange, мс (например, 300 для поиска по мере ввода) */
  debounceMs?: number;
  size?: FieldSize;
}

/** Поле поиска с иконкой и кнопкой очистки */
export function SearchInput({
  value,
  defaultValue = '',
  onValueChange,
  debounceMs = 0,
  size = 'md',
  placeholder,
  className,
  ...rest
}: SearchInputProps) {
  const t = useT('ui');
  const [text, setText] = useState(value ?? defaultValue);
  const [prevValue, setPrevValue] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Значение сменили снаружи (например, «Сбросить фильтры») — показать его
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== undefined) setText(value);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const emit = (next: string, immediate = false) => {
    clearTimeout(timer.current);
    if (!onValueChange) return;
    if (immediate || debounceMs <= 0) onValueChange(next);
    else timer.current = setTimeout(() => onValueChange(next), debounceMs);
  };

  return (
    <div className={cn('relative w-full', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        value={text}
        placeholder={placeholder ?? t('search.placeholder')}
        onChange={(e) => {
          setText(e.target.value);
          emit(e.target.value);
        }}
        className={cn(
          FIELD_BASE,
          FIELD_BORDER.normal,
          FIELD_HEIGHT[size],
          'pl-11 pr-12 [&::-webkit-search-cancel-button]:appearance-none',
        )}
        {...rest}
      />
      {text !== '' && (
        <button
          type="button"
          aria-label={t('search.clear')}
          onClick={() => {
            setText('');
            emit('', true);
          }}
          className="absolute right-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
        >
          <X aria-hidden className="size-5" />
        </button>
      )}
    </div>
  );
}
