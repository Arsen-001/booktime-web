import Link from 'next/link';
import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cn } from '@/lib/cn';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

const INTERACTIVE =
  'cursor-pointer transition-[box-shadow,border-color,transform] duration-200 ease-out hover:border-border-strong/60 hover:shadow-md motion-safe:hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm';


/** Карточка-ссылка ведёт «вглубь» — переход страницы вперёд (PageTransition) */
const NAV_FORWARD = ['nav-forward'];
export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  padding?: CardPadding;
  /** Карточка кликабельна: подсветка при наведении */
  interactive?: boolean;
  as?: 'div' | 'section' | 'article' | 'li' | 'aside';
  /**
   * Карточка-ссылка (next/link): нажимается вся карточка, кольцо фокуса идёт по её скруглению (а не прямоугольником
   * вокруг, как у карточки, обёрнутой в <Link>). Кнопки и ссылки внутри такой карточки не кладите.
   */
  href?: string;
}

/** Базовая карточка: поверхность, тонкая рамка, скругление, мягкая тень */
export function Card({ padding = 'md', interactive = false, as = 'div', href, className, ...rest }: CardProps) {
  // DESIGN.md: белая карточка, радиус 16, тонкая рамка, без тени (тень — только у поднятых слоёв и при наведении)
  const base = cn('rounded-lg border border-border bg-surface', PADDING[padding]);

  if (href) {
    return (
      <Link
        href={href}
        transitionTypes={NAV_FORWARD}
        data-card-link=""
        className={cn(
          'block text-fg no-underline',
          base,
          INTERACTIVE,
          'focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          className,
        )}
        {...(rest as Omit<ComponentPropsWithoutRef<'a'>, 'href'>)}
      />
    );
  }

  const Tag = as as ElementType;
  return (
    <Tag className={cn(base, interactive && cn(INTERACTIVE, 'focus-within:border-primary/60'), className)} {...rest} />
  );
}
