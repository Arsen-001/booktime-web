'use client';

import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';

interface FieldChildProps {
  id?: string;
  invalid?: boolean;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-required'?: boolean;
}

export interface FormFieldProps {
  label: ReactNode;
  hint?: ReactNode;
  /** Текст ошибки; есть — поле подсвечивается и получает aria-invalid */
  error?: ReactNode;
  required?: boolean;
  /** Показать «необязательно» рядом с подписью */
  optional?: boolean;
  /** Одно поле (Input, Select, PhoneInput…) — ему проставятся id и aria-атрибуты */
  children: ReactElement;
  id?: string;
  className?: string;
  classNames?: { root?: string; label?: string; hint?: string; error?: string };
}

/** Подпись уже говорит «(необязательно)» — вторую пометку не дописываем */
const OPTIONAL_TAIL = /\((необязательно|не обязательно|optional|ոչ պարտադիր)\)\s*$/i;

/** Подпись + поле + подсказка + ошибка. Связывает их через id / aria-describedby */
export function FormField({
  label,
  hint,
  error,
  required = false,
  optional = false,
  children,
  id,
  className,
  classNames,
}: FormFieldProps) {
  const t = useT('ui');
  const autoId = useId();
  const child = isValidElement<FieldChildProps>(children) ? children : null;
  const fieldId = id ?? child?.props.id ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [child?.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;
  const isComponent = child !== null && typeof child.type !== 'string';

  const field = child
    ? cloneElement(child, {
        id: fieldId,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : child.props['aria-invalid'],
        'aria-required': required || undefined,
        ...(isComponent && error ? { invalid: true } : {}),
      })
    : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className, classNames?.root)}>
      <label htmlFor={fieldId} className={cn('text-sm font-medium text-fg', classNames?.label)}>
        {label}
        {required && (
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        )}
        {optional && !required && !(typeof label === 'string' && OPTIONAL_TAIL.test(label)) && (
          <span className="ml-1.5 font-normal text-muted">({t('optional')})</span>
        )}
      </label>
      {field}
      {hint && !error && (
        <p id={hintId} className={cn('text-sm text-muted', classNames?.hint)}>
          {hint}
        </p>
      )}
      {hint && error && (
        <p id={hintId} className="sr-only">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          aria-live="polite"
          className={cn('flex items-start gap-1.5 text-sm text-danger', classNames?.error)}
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
