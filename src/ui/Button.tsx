import Link from 'next/link';
import type { ComponentProps, ComponentPropsWithRef, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { DropdownChevron } from '@/ui/DropdownChevron';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

// Нажатие — лёгкое «вдавливание» (active:scale), без прыжка раскладки; при reduced-motion переходы гасятся глобально
const BASE =
  'inline-flex items-center justify-center font-medium whitespace-nowrap select-none ' +
  'transition-[color,background-color,border-color,box-shadow,transform,opacity] duration-150 ease-out ' +
  'active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none aria-disabled:opacity-50 aria-disabled:pointer-events-none';

// DESIGN.md: 36 / 40 / 44 на компьютере, радиус 10 (rounded-md). Телефон — на 4 px выше: зона нажатия ≥ 40–48 под палец
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-10 md:h-9 px-3.5 gap-1.5 rounded-md text-sm',
  md: 'h-11 md:h-10 px-4 gap-2 rounded-md text-[0.9375rem] md:text-sm',
  lg: 'h-12 md:h-11 px-5 gap-2 rounded-md text-base font-semibold',
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-contrast shadow-xs hover:bg-primary-hover active:shadow-none',
  // Белая с тонкой рамкой — как в макете (кнопка «Поиск», «Сегодня»); спокойнее серой заливки
  secondary: 'border border-border bg-surface text-fg hover:border-border-strong/45 hover:bg-surface-2',
  // Рамка мягче, чем у полей: кнопку узнают по подписи, а резкая рамка у каждой второй кнопки шумит
  outline: 'border border-border-strong/55 bg-surface text-fg shadow-xs hover:border-border-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-fg hover:bg-surface-2 active:bg-surface-3',
  danger: 'bg-danger text-primary-contrast shadow-xs hover:bg-danger/90 active:shadow-none',
  link: 'h-auto min-h-10 min-w-10 px-1 bg-transparent text-primary-text underline-offset-4 decoration-2 hover:underline active:scale-100',
};

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: '[&_svg]:size-4',
  md: '[&_svg]:size-[18px]',
  lg: '[&_svg]:size-5',
};

/** Стрелка у кнопки на залитом фоне — цвета текста, чуть тише; на светлом — приглушённая */
const CHEVRON_ON_FILL: Partial<Record<ButtonVariant, true>> = { primary: true, danger: true };

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** Классы кнопки — для ссылок и других элементов, которые должны выглядеть как кнопка */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: ButtonClassOptions = {}): string {
  return cn(BASE, SIZE[size], ICON_SIZE[size], VARIANT[variant], fullWidth && 'w-full');
}

export interface ButtonProps extends ComponentPropsWithRef<'button'>, ButtonClassOptions {
  /** Идёт действие: спиннер вместо левой иконки, кнопка недоступна */
  loading?: boolean;
  /**
   * Стрелка ⌄ справа. По умолчанию — сама, если кнопка открывает список (есть aria-haspopup: Popover/DropdownMenu
   * раскладывают его в trigger); поворачивается по aria-expanded. false — убрать.
   */
  chevron?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  className,
  children,
  type = 'button',
  chevron,
  ...rest
}: ButtonProps) {
  const popup = rest['aria-haspopup'];
  // Своя правая иконка у кнопки-меню — это и есть её стрелка; тогда вторую не ставим
  const showChevron = chevron ?? (popup !== undefined && popup !== false && popup !== 'false' && !rightIcon);
  const expanded = rest['aria-expanded'] === true || rest['aria-expanded'] === 'true';
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-variant={variant}
      className={cn(buttonClasses({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {loading ? <LoaderCircle aria-hidden className="animate-spin" /> : leftIcon}
      {children}
      {rightIcon}
      {showChevron && (
        <DropdownChevron
          open={expanded}
          className={cn('size-4!', CHEVRON_ON_FILL[variant] && 'text-current opacity-75', '-mr-0.5')}
        />
      )}
    </button>
  );
}

export interface LinkButtonProps extends Omit<ComponentProps<typeof Link>, 'href'>, ButtonClassOptions {
  href: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

/** Ссылка next/link, которая выглядит как кнопка */
export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      data-variant={variant}
      className={cn(buttonClasses({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
