import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ProgressRing } from '@/ui/onboarding/ProgressRing';

export interface ChecklistPillProps {
  href: string;
  done: number;
  total: number;
  /** «Настройка», «Первые шаги» */
  children: ReactNode;
  progressLabel?: string;
  className?: string;
}

/**
 * Маленькая «таблетка» прогресса настройки для верхней полосы или меню: кольцо 3/6 и подпись, ведёт к чек-листу.
 * Прячьте её, когда всё сделано (done >= total).
 */
export function ChecklistPill({ href, done, total, children, progressLabel, className }: ChecklistPillProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-11 items-center gap-2.5 rounded-full border border-border bg-surface py-1 pr-4 pl-1 text-sm font-medium text-fg shadow-xs',
        'transition-[background-color,box-shadow] hover:bg-surface-2 hover:shadow-sm',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className,
      )}
    >
      <ProgressRing done={done} total={total} size="sm" label={progressLabel} />
      {children}
    </Link>
  );
}
