'use client';

import { Check } from 'lucide-react';
import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ChoiceCardProps extends Omit<ComponentPropsWithRef<'button'>, 'title' | 'role'> {
  title: ReactNode;
  description?: ReactNode;
  /** Иконка lucide 20 px слева */
  icon?: ReactNode;
  selected?: boolean;
  /** radio — один из группы (кружок), checkbox — несколько (квадрат) */
  kind?: 'radio' | 'checkbox';
}

/**
 * Карточка-вариант выбора: иконка, заголовок, пояснение. Выбранная — рамка primary и отметка справа.
 * Обычно внутри ChoiceGroup (он даёт клавиатуру и роли); отдельно — для своих раскладок.
 */
export function ChoiceCard({
  title,
  description,
  icon,
  selected = false,
  kind = 'radio',
  disabled,
  className,
  type = 'button',
  ...rest
}: ChoiceCardProps) {
  return (
    <button
      type={type}
      role={kind}
      aria-checked={selected}
      disabled={disabled}
      data-choice-card=""
      className={cn(
        'group/choice relative flex min-h-16 w-full items-start gap-3 rounded-xl border bg-surface p-4 text-left',
        'transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-primary bg-primary-soft/40 shadow-xs ring-1 ring-primary'
          : 'border-border-strong/40 hover:border-border-strong/80 hover:bg-surface-2/60 active:scale-[0.99]',
        className,
      )}
      {...rest}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-lg transition-colors [&_svg]:size-5',
            selected ? 'bg-primary text-primary-contrast' : 'bg-surface-2 text-muted group-hover/choice:text-fg',
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="block text-base leading-snug font-semibold text-fg">{title}</span>
        {description && <span className="mt-1 block text-sm leading-relaxed text-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center border-2 transition-colors',
          kind === 'radio' ? 'rounded-full' : 'rounded-[6px]',
          selected ? 'border-primary bg-primary text-primary-contrast' : 'border-border-strong/70 bg-surface',
        )}
      >
        {selected && <Check className="size-3" strokeWidth={3.5} />}
      </span>
    </button>
  );
}
