'use client';

import type { ReactNode } from 'react';
import type { ISODate } from '@/domain/core';
import { useFormat } from '@/i18n/useFormat';
import { cn } from '@/lib/cn';
import { ScrollRow } from '@/ui/ScrollRow';

export interface SlotRowProps {
  /** День окон: подпись «Сегодня / Завтра / пт, 26 сентября» один раз перед окнами */
  date?: ISODate;
  /** Своя подпись вместо даты */
  label?: ReactNode;
  /** Окна — SlotButton */
  children: ReactNode;
  /** Строка до края экрана на телефоне (в карточке — false) */
  bleed?: boolean;
  className?: string;
}

/**
 * Ряд свободных окон одного дня: подпись дня и окна в одну строку с прокруткой (без переноса), край затухает,
 * на десктопе — стрелки. Одинаковый у клиента, на публичной странице и в кабинете.
 */
export function SlotRow({ date, label, children, bleed = false, className }: SlotRowProps) {
  const fmt = useFormat();
  const caption = label ?? (date ? fmt.relativeDay(date) : null);
  const text = typeof caption === 'string' ? caption : undefined;
  return (
    <ScrollRow bleed={bleed} aria-label={text} className={cn('w-full', className)}>
      {caption && (
        <span className="inline-block pr-1 text-sm font-medium whitespace-nowrap text-muted first-letter:uppercase">
          {caption}
        </span>
      )}
      {children}
    </ScrollRow>
  );
}
