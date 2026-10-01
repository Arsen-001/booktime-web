'use client';

import { CircleHelp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button, type ButtonSize } from '@/ui/Button';
import { IconButton } from '@/ui/IconButton';

export interface TourButtonProps {
  /** Обычно `tour.start` из useTour */
  onClick: () => void;
  /** Подпись: «Как это работает» (из словаря раздела) */
  children: string;
  /**
   * Тур ещё не видели — рядом с «?» мягкая точка-приглашение (без пульса: пульсирует только Beacon).
   * Передайте `!tour.seen`.
   */
  fresh?: boolean;
  /** Только значок «?» — для тесной шапки на телефоне; подпись уходит в aria-label */
  iconOnly?: boolean;
  size?: ButtonSize;
  className?: string;
}

/**
 * Кнопка повтора тура «Как это работает» рядом с заголовком экрана (PageHeader actions). Одинаковая во всех
 * разделах: ghost, значок «?», не спорит с главным действием экрана.
 *
 *   const tour = useTour('journal.intro');
 *   <PageHeader title={…} actions={<><TourButton onClick={tour.start} fresh={!tour.seen}>{t('howItWorks')}</TourButton><Button>…</Button></>} />
 */
export function TourButton({
  onClick,
  children,
  fresh = false,
  iconOnly = false,
  size = 'sm',
  className,
}: TourButtonProps) {
  const dot = fresh ? (
    <span aria-hidden className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-surface" />
  ) : null;

  if (iconOnly) {
    return (
      <span className={cn('relative inline-flex', className)}>
        <IconButton icon={<CircleHelp aria-hidden />} label={children} onClick={onClick} className="rounded-full" />
        {dot}
      </span>
    );
  }

  return (
    <Button
      variant="ghost"
      size={size}
      onClick={onClick}
      data-tour-button=""
      leftIcon={
        <span className="relative inline-flex">
          <CircleHelp aria-hidden />
          {fresh && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent ring-2 ring-surface"
            />
          )}
        </span>
      }
      className={cn('text-muted hover:text-fg', className)}
    >
      {children}
    </Button>
  );
}
