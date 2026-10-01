'use client';

import { useEffect, useId, useRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useControllableState } from '@/ui/hooks/useControllableState';

export interface CheckboxProps extends Omit<
  ComponentPropsWithoutRef<'input'>,
  'type' | 'checked' | 'defaultChecked' | 'onChange' | 'size'
> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Частично выбрано (например, «выбрать все» в таблице) */
  indeterminate?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  classNames?: { root?: string; box?: string; label?: string };
}

/** Флажок: квадрат 20 px, но вся строка с подписью — зона нажатия не меньше 44 px */
export function Checkbox({
  checked,
  defaultChecked = false,
  onCheckedChange,
  indeterminate = false,
  label,
  description,
  disabled,
  className,
  classNames,
  id,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descId = description ? `${inputId}-desc` : undefined;
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useControllableState(checked, defaultChecked, onCheckedChange);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      htmlFor={inputId}
      className={cn(
        'inline-flex min-h-11 cursor-pointer items-start gap-3 py-2.5 select-none',
        !label && 'min-w-11 items-center justify-center py-0',
        disabled && 'cursor-not-allowed opacity-60',
        className,
        classNames?.root,
      )}
    >
      <span className="relative mt-0.5 inline-flex size-5 shrink-0 items-center justify-center">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          checked={value}
          disabled={disabled}
          aria-describedby={descId}
          onChange={(e) => setValue(e.target.checked)}
          className={cn(
            'peer size-5 cursor-pointer appearance-none rounded-[6px] border-2 border-border-strong bg-surface transition-colors hover:border-primary',
            'checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary',
            'disabled:cursor-not-allowed',
            classNames?.box,
          )}
          {...rest}
        />
        {indeterminate ? (
          <Minus aria-hidden strokeWidth={3} className="pointer-events-none absolute size-3.5 text-primary-contrast" />
        ) : (
          <Check
            aria-hidden
            strokeWidth={3}
            className="pointer-events-none absolute size-3.5 text-primary-contrast opacity-0 peer-checked:opacity-100"
          />
        )}
      </span>
      {(label || description) && (
        <span className={cn('min-w-0 leading-snug', classNames?.label)}>
          {label && <span className="block text-base text-fg">{label}</span>}
          {description && (
            <span id={descId} className="mt-0.5 block text-sm text-muted">
              {description}
            </span>
          )}
        </span>
      )}
    </label>
  );
}
