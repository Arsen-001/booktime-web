'use client';

import { useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useControllableState } from '@/ui/hooks/useControllableState';

export interface RadioProps extends Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'size'> {
  label?: ReactNode;
  description?: ReactNode;
  classNames?: { root?: string; control?: string; label?: string };
}

/** Одиночный переключатель-кружок. Обычно используется через RadioGroup */
export function Radio({ label, description, disabled, className, classNames, id, ...rest }: RadioProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const descId = description ? `${inputId}-desc` : undefined;
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'inline-flex min-h-11 cursor-pointer items-start gap-3 py-2.5 select-none',
        disabled && 'cursor-not-allowed opacity-60',
        className,
        classNames?.root,
      )}
    >
      <input
        id={inputId}
        type="radio"
        disabled={disabled}
        aria-describedby={descId}
        className={cn(
          'mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-border-strong bg-surface transition-all',
          'checked:border-[6px] checked:border-primary disabled:cursor-not-allowed',
          classNames?.control,
        )}
        {...rest}
      />
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

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  orientation?: 'vertical' | 'horizontal';
  disabled?: boolean;
  /** Ошибка выбора (FormField проставляет сам) — подсвечивает кружки */
  invalid?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
  id?: string;
}

/** Группа переключателей: выбор одного варианта из нескольких (стрелки работают сами) */
export function RadioGroup({
  options,
  value,
  defaultValue = '',
  onValueChange,
  name,
  orientation = 'vertical',
  disabled = false,
  invalid = false,
  className,
  id,
  ...aria
}: RadioGroupProps) {
  const autoName = useId();
  const [current, setCurrent] = useControllableState(value, defaultValue, onValueChange);
  return (
    <div
      id={id}
      role="radiogroup"
      className={cn(orientation === 'vertical' ? 'flex flex-col' : 'flex flex-wrap gap-x-6', className)}
      {...aria}
    >
      {options.map((o) => (
        <Radio
          key={o.value}
          name={name ?? autoName}
          value={o.value}
          checked={current === o.value}
          onChange={() => setCurrent(o.value)}
          disabled={disabled || o.disabled}
          label={o.label}
          description={o.description}
          classNames={invalid ? { control: 'border-danger' } : undefined}
        />
      ))}
    </div>
  );
}
