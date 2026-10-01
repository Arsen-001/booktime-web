'use client';

import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useControllableState } from '@/ui/hooks/useControllableState';

export interface SwitchProps extends Omit<
  ComponentPropsWithoutRef<'button'>,
  'onChange' | 'value' | 'defaultValue' | 'children'
> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  /** Подпись слева, переключатель справа (удобно в списках настроек) */
  labelPosition?: 'start' | 'end';
  classNames?: { root?: string; track?: string; label?: string };
}

/** Переключатель вкл/выкл (role=switch). Зона нажатия ≥ 44 px */
export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  label,
  description,
  labelPosition = 'end',
  disabled,
  className,
  classNames,
  id,
  ...rest
}: SwitchProps) {
  const autoId = useId();
  const buttonId = id ?? autoId;
  const labelId = `${buttonId}-label`;
  const descId = `${buttonId}-desc`;
  const [value, setValue] = useControllableState(checked, defaultChecked, onCheckedChange);

  const control = (
    <button
      id={buttonId}
      type="button"
      role="switch"
      aria-checked={value}
      aria-labelledby={label ? labelId : undefined}
      aria-describedby={description ? descId : undefined}
      disabled={disabled}
      onClick={() => setValue(!value)}
      className="group relative inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:cursor-not-allowed"
      {...rest}
    >
      <span
        className={cn(
          'relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200',
          value ? 'bg-primary' : 'bg-border-strong',
          classNames?.track,
        )}
      >
        <span
          className={cn(
            'inline-block size-6 rounded-full bg-surface shadow-sm transition-transform duration-200 dark:bg-fg',
            value ? 'translate-x-[1.375rem]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );

  if (!label && !description) {
    return <span className={cn('inline-flex', disabled && 'opacity-60', className, classNames?.root)}>{control}</span>;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3',
        labelPosition === 'start' && 'flex-row-reverse justify-between',
        disabled && 'opacity-60',
        className,
        classNames?.root,
      )}
    >
      {control}
      <label htmlFor={buttonId} className={cn('min-w-0 flex-1 cursor-pointer py-2 leading-snug', classNames?.label)}>
        {label && (
          <span id={labelId} className="block text-base text-fg">
            {label}
          </span>
        )}
        {description && (
          <span id={descId} className="mt-0.5 block text-sm text-muted">
            {description}
          </span>
        )}
      </label>
    </div>
  );
}
