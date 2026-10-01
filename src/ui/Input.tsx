import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type FieldSize = 'sm' | 'md' | 'lg';

/** Общий вид полей ввода — используется Input, Textarea, Select, PhoneInput и др. */
export const FIELD_BASE =
  'w-full rounded-xl border bg-surface text-base text-fg shadow-xs placeholder:text-muted/80 ' +
  'transition-[border-color,box-shadow,background-color] duration-150 ease-out ' +
  'focus-visible:outline-none focus:border-primary focus:shadow-none focus:ring-4 focus:ring-focus/15 ' +
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted disabled:shadow-none';

export const FIELD_BORDER: Record<'normal' | 'invalid', string> = {
  normal: 'border-border-strong hover:border-fg/55',
  invalid: 'border-danger hover:border-danger focus:border-danger focus:ring-danger/15',
};

export const FIELD_HEIGHT: Record<FieldSize, string> = {
  sm: 'h-10',
  md: 'h-11',
  lg: 'h-13',
};

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  size?: FieldSize;
  invalid?: boolean;
  /** Иконка слева внутри поля */
  leftIcon?: ReactNode;
  /** Элемент справа внутри поля (кнопка, единица измерения) */
  rightSlot?: ReactNode;
  /** className — на обёртку; classNames.input — на само поле */
  classNames?: { root?: string; input?: string };
}

export function Input({
  size = 'md',
  invalid = false,
  leftIcon,
  rightSlot,
  className,
  classNames,
  ...rest
}: InputProps) {
  return (
    <div className={cn('relative w-full', className, classNames?.root)}>
      {leftIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted [&_svg]:size-5">
          {leftIcon}
        </span>
      )}
      <input
        aria-invalid={invalid || undefined}
        className={cn(
          FIELD_BASE,
          FIELD_BORDER[invalid ? 'invalid' : 'normal'],
          FIELD_HEIGHT[size],
          'px-3.5',
          leftIcon && 'pl-11',
          rightSlot && 'pr-12',
          classNames?.input,
        )}
        {...rest}
      />
      {rightSlot && <span className="absolute inset-y-0 right-1 flex items-center">{rightSlot}</span>}
    </div>
  );
}
