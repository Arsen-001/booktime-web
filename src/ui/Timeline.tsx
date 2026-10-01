import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { BadgeTone } from '@/ui/Badge';

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-fg',
  primary: 'bg-primary-soft text-primary-text',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export interface TimelineItem {
  id: string;
  title: ReactNode;
  time?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  tone?: BadgeTone;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

/** Лента событий: история записи, визиты клиента, журнал изменений */
export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn('relative flex flex-col', className)}>
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
          {i < items.length - 1 && (
            <span aria-hidden className="absolute bottom-0 left-4 top-9 w-px -translate-x-1/2 bg-border" />
          )}
          <span
            className={cn(
              'relative z-[1] inline-flex size-8 shrink-0 items-center justify-center rounded-full [&_svg]:size-4',
              TONE[item.tone ?? 'neutral'],
            )}
          >
            {item.icon ?? <span className="size-2 rounded-full bg-current" />}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-base font-medium text-fg">{item.title}</p>
              {item.time && <p className="text-sm text-muted">{item.time}</p>}
            </div>
            {item.description && <div className="mt-0.5 text-sm text-muted">{item.description}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
