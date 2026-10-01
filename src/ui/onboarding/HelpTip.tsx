'use client';

import { CircleHelp } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Popover } from '@/ui/Popover';

export interface HelpTipProps {
  /** Подпись кнопки для скринридера и заголовок панели: «Что такое горящее окно?» */
  label: string;
  /** Пояснение: 1–3 фразы */
  children: ReactNode;
  /** Ссылка или кнопка внизу («Подробнее», «Открыть настройки») */
  action?: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}

/**
 * Значок «?» рядом с непонятным словом или полем: по нажатию — короткое пояснение. В отличие от Tooltip
 * работает пальцем на телефоне и держит текст, пока человек читает. Зона нажатия 40 px, значок 16 px.
 */
export function HelpTip({ label, children, action, side = 'bottom', className }: HelpTipProps) {
  return (
    <Popover
      side={side}
      align="center"
      label={label}
      className="w-72 p-4"
      trigger={(p) => (
        <button
          type="button"
          {...p}
          aria-label={label}
          className={cn(
            'inline-flex size-10 shrink-0 items-center justify-center rounded-full align-middle text-muted transition-colors',
            'hover:bg-surface-2 hover:text-primary-text aria-expanded:bg-primary-soft aria-expanded:text-primary-text',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
            '-my-2 [&_svg]:size-4',
            className,
          )}
        >
          <CircleHelp aria-hidden />
        </button>
      )}
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm leading-snug font-semibold text-fg">{label}</p>
        <div className="text-sm leading-relaxed text-muted">{children}</div>
        {action && <div className="pt-1">{action}</div>}
      </div>
    </Popover>
  );
}
