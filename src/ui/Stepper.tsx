'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n/useT';

export interface StepItem {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepItem[];
  /** Индекс текущего шага (с 0) */
  current: number;
  /** Нажатие на шаг (например, вернуться к пройденному) */
  onStepClick?: (index: number) => void;
  className?: string;
}

/** Шаги мастера (регистрация, быстрый старт). На телефоне — «Шаг 2 из 4» с полоской */
export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  const t = useT('ui');
  const total = steps.length;
  // «Шаг 1 из 3» — уже треть пути (раньше полоса была пустой и читалась как разделитель)
  const progress = total > 0 ? Math.min(100, Math.max(0, ((current + 1) / total) * 100)) : 100;

  return (
    <nav
      aria-label={t('stepper.step', { current: current + 1, total })}
      className={cn('@container min-w-0', className)}
    >
      {/* Телефон */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-base font-semibold text-fg">{steps[current]?.label}</p>
          <p className="shrink-0 text-sm text-muted tabular-nums">
            {t('stepper.step', { current: current + 1, total })}
          </p>
        </div>
        {/* Полоса из сегментов: видно, сколько шагов всего и сколько пройдено */}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="mt-2.5 flex gap-1"
        >
          {steps.map((step, i) => (
            <span
              key={step.id}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                i <= current ? 'bg-primary' : 'bg-surface-3',
              )}
            />
          ))}
        </div>
      </div>

      {/* Планшет и шире */}
      <ol className="hidden min-w-0 items-center gap-2 sm:flex">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = Boolean(onStepClick) && i !== current;
          const Tag = clickable ? 'button' : 'div';
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
              <Tag
                {...(clickable ? { type: 'button' as const, onClick: () => onStepClick?.(i) } : {})}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'relative inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg pr-2 text-left',
                  clickable && 'hover:bg-surface-2',
                )}
              >
                <span
                  className={cn(
                    'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                    done && 'bg-primary text-primary-contrast',
                    active && 'bg-primary-soft text-primary-text ring-2 ring-primary',
                    !done && !active && 'bg-surface-3 text-muted',
                  )}
                >
                  {done ? <Check aria-hidden className="size-4" strokeWidth={3} /> : i + 1}
                </span>
                {/* Узкая колонка (< 720 px): подпись только у текущего шага, у остальных — номер или галочка.
                    Активная подпись тоже truncate (min-w-0 у родителей) — иначе длинный текст наезжает
                    на кружок следующего шага (было shrink-0 + whitespace-nowrap без ограничения ширины). */}
                <span
                  className={cn(
                    'min-w-0 truncate text-sm font-medium',
                    active ? 'font-semibold text-fg' : '@max-[45rem]:sr-only',
                    !active && (done ? 'text-fg' : 'text-muted'),
                  )}
                >
                  {step.label}
                </span>
              </Tag>
              {i < total - 1 && (
                <span aria-hidden className={cn('h-px min-w-4 flex-1', done ? 'bg-primary' : 'bg-border')} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
