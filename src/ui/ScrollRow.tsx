'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { scrollEdgeClass, useScrollEdges } from '@/ui/hooks/useScrollEdges';

export type ScrollRowGap = 'sm' | 'md' | 'lg';

const GAP: Record<ScrollRowGap, string> = {
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
};

export interface ScrollRowProps {
  children: ReactNode;
  gap?: ScrollRowGap;
  /**
   * Ряд выходит за поля страницы до края экрана на телефоне (сторис, окна времени): первый элемент стоит по полю
   * 16 px, а при прокрутке содержимое уходит под край, а не обрезается на поле.
   */
  bleed?: boolean;
  /** Стрелки ‹ › по краям на десктопе, когда есть что листать (по умолчанию да) */
  arrows?: boolean;
  className?: string;
  classNames?: { track?: string };
  'aria-label'?: string;
}

/**
 * Горизонтальный ряд с прокруткой: чипы фильтров, дни, сторис, карточки. Край мягко затухает там, где есть скрытое;
 * на десктопе — стрелки (прокрутка на 80 % ширины), с клавиатуры — ←/→, когда фокус на ряду.
 */
export function ScrollRow({
  children,
  gap = 'sm',
  bleed = false,
  arrows = true,
  className,
  classNames,
  'aria-label': ariaLabel,
}: ScrollRowProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const edges = useScrollEdges(trackRef);
  const overflow = edges.start || edges.end;

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      scrollBy(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      scrollBy(-1);
    }
  };

  const arrow = (dir: 1 | -1) => {
    const visible = dir === 1 ? edges.end : edges.start;
    const Icon = dir === 1 ? ChevronRight : ChevronLeft;
    return (
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={() => scrollBy(dir)}
        className={cn(
          'absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface text-fg shadow-md transition-[opacity,transform] duration-150 hover:bg-surface-2 active:scale-95 md:grid',
          dir === 1 ? '-right-2' : '-left-2',
          visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <Icon className="size-4" />
      </button>
    );
  };

  return (
    <div className={cn('relative min-w-0', bleed && 'max-md:-mx-4', className)}>
      <div
        ref={trackRef}
        role={ariaLabel ? 'group' : undefined}
        aria-label={ariaLabel}
        tabIndex={overflow ? 0 : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          'no-scrollbar flex items-center overflow-x-auto scroll-smooth rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-focus/40',
          GAP[gap],
          // Запас 4 px сверху/снизу и по краям: кольцо фокуса, рамка выбранного и тень карточки не срезаются прокруткой
          '-my-1 py-1',
          bleed ? 'max-md:scroll-px-4 max-md:px-4 md:-mx-1 md:px-1' : '-mx-1 scroll-px-1 px-1',
          scrollEdgeClass(edges),
          '[&>*]:shrink-0',
          classNames?.track,
        )}
      >
        {children}
      </div>
      {arrows && (
        <>
          {arrow(-1)}
          {arrow(1)}
        </>
      )}
    </div>
  );
}
