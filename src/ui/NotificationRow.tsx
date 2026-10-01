'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface NotificationRowProps {
  /** Иконка события (lucide), без обёртки — круг рисует строка */
  icon: ReactNode;
  /** danger — отмена/удаление, остальное — primary */
  tone?: 'primary' | 'danger';
  /** Что случилось: «Новая запись», «Запись отменена» */
  title: ReactNode;
  /** Кто, на что и когда визит: «Мариам · Стрижка · 28 сент., 14:00» — нет данных, строки нет */
  detail?: ReactNode;
  /** Когда пришло уведомление */
  time: ReactNode;
  unread?: boolean;
  /** compact — выпадающий список колокольчика, card — центр уведомлений */
  variant?: 'compact' | 'card';
  onClick: () => void;
}

const VARIANT: Record<NonNullable<NotificationRowProps['variant']>, { root: string; badge: string; title: string; sub: string }> = {
  compact: {
    root: 'rounded-xl px-2 py-2 hover:bg-surface-2/60',
    badge: 'size-8',
    title: 'text-sm',
    sub: 'text-xs',
  },
  card: {
    root: 'rounded-lg border border-border bg-surface px-4 py-3 hover:bg-surface-2/60',
    badge: 'size-9',
    title: 'text-base',
    sub: 'text-sm',
  },
};

/**
 * Одна строка уведомления о записи — общая для колокольчика в шапке и центра уведомлений (Ув10), чтобы они не
 * расходились: иконка события, что случилось, кто/что/когда визит и время уведомления; точка — не прочитано.
 */
export function NotificationRow({ icon, tone = 'primary', title, detail, time, unread, variant = 'compact', onClick }: NotificationRowProps) {
  const v = VARIANT[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 text-left transition-colors duration-150', v.root)}
    >
      <span
        className={cn(
          'grid shrink-0 place-items-center rounded-full [&_svg]:size-4',
          v.badge,
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-primary-soft text-primary-text',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('flex items-center gap-2 font-medium text-fg', v.title)}>
          {unread && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-danger" />}
          <span className="truncate">{title}</span>
        </span>
        {detail && <span className={cn('block truncate text-fg/80', v.sub)}>{detail}</span>}
        <span className={cn('block text-muted', v.sub)}>{time}</span>
      </span>
    </button>
  );
}
