import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SectionPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<SectionPadding, string> = {
  none: '',
  sm: 'px-4 py-3',
  md: 'px-4 py-4 sm:px-5 sm:pb-5',
  lg: 'px-5 py-5 sm:px-6 sm:pb-6',
};

export interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** Кнопки в шапке секции */
  actions?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  /** Отступы тела секции */
  padding?: SectionPadding;
  className?: string;
  classNames?: { header?: string; body?: string; footer?: string };
  id?: string;
}

/** Секция страницы в карточке: заголовок, описание, действия, содержимое, подвал */
export function SectionCard({
  title,
  description,
  actions,
  footer,
  children,
  padding = 'md',
  className,
  classNames,
  id,
}: SectionCardProps) {
  return (
    <section id={id} className={cn('rounded-lg border border-border bg-surface', className)}>
      <div
        className={cn(
          'flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:pt-5',
          !children && 'pb-4 sm:pb-5',
          classNames?.header,
        )}
      >
        <div className="min-w-0">
          <h2 className="text-[1.0625rem] leading-snug font-bold tracking-tight text-fg">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children !== undefined && children !== null && (
        <div className={cn(PADDING[padding], classNames?.body)}>{children}</div>
      )}
      {footer && (
        <div
          className={cn(
            'flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-border bg-surface-2/40 px-4 py-3 sm:px-5',
            classNames?.footer,
          )}
        >
          {footer}
        </div>
      )}
    </section>
  );
}
