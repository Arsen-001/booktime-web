'use client';

import { useLayoutEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export interface SpotlightProps {
  /** Что подсветить; null — затемнить весь экран без «окна» */
  target: HTMLElement | null;
  /** Отступ подсветки вокруг элемента, px */
  padding?: number;
  className?: string;
}

/**
 * Затемнение экрана с «окном» вокруг элемента (для туров). Окно — прозрачный прямоугольник с огромной тенью
 * цвета --overlay и кольцом primary; следует за элементом при прокрутке и изменении размеров.
 * Сам ничего не ловит (pointer-events: none) — клики гасит слой-подложка в Tour.
 */
export function Spotlight({ target, padding = 6, className }: SpotlightProps) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!el || !target) return;
    const update = () => {
      const r = target.getBoundingClientRect();
      const s = el.style;
      // Первое появление — сразу на месте, без «проезда» окна из левого верхнего угла через весь экран;
      // плавный переход — только между шагами тура (элемент уже стоит, меняется цель)
      const first = el.getAttribute('data-placed') !== '1';
      if (first) s.setProperty('transition', 'none');
      s.setProperty('top', `${Math.round(r.top - padding)}px`);
      s.setProperty('left', `${Math.round(r.left - padding)}px`);
      s.setProperty('width', `${Math.round(r.width + padding * 2)}px`);
      s.setProperty('height', `${Math.round(r.height + padding * 2)}px`);
      // Скругление окна повторяет скругление элемента (круглая кнопка — круглое окно), плюс отступ
      const radius = Number.parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0;
      s.setProperty('border-radius', `${Math.round(Math.min(radius, r.height / 2) + padding)}px`);
      s.setProperty('opacity', '1');
      if (first) {
        el.getBoundingClientRect(); // зафиксировать положение до включения перехода
        s.removeProperty('transition');
        el.setAttribute('data-placed', '1');
      }
    };
    update();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : undefined;
    observer?.observe(target);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [el, target, padding]);

  if (!target) {
    return (
      <div aria-hidden className={cn('pointer-events-none fixed inset-0 animate-fade-in bg-overlay', className)} />
    );
  }

  return (
    <div
      ref={setEl}
      aria-hidden
      data-spotlight
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        opacity: 0,
        // Кольцо — в той же тени: классы ring-* тоже пишут box-shadow и перебиваются этим стилем
        boxShadow: '0 0 0 2px var(--surface), 0 0 0 4px var(--primary), 0 0 0 200vmax var(--overlay)',
      }}
      className={cn(
        'pointer-events-none rounded-xl',
        'transition-[top,left,width,height,opacity] duration-300 ease-out motion-reduce:transition-none',
        className,
      )}
    />
  );
}
