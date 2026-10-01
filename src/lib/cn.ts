import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** Имена цветов-токенов из globals.css — чтобы twMerge понимал, что bg-surface и bg-surface-2 конфликтуют. */
const TOKEN_COLORS = [
  'bg', 'surface', 'surface-2', 'surface-3', 'border', 'border-strong', 'overlay',
  'fg', 'muted',
  'primary', 'primary-hover', 'primary-soft', 'primary-text', 'primary-contrast',
  'accent', 'accent-soft', 'accent-text', 'accent-contrast',
  'success', 'success-soft', 'warning', 'warning-soft', 'danger', 'danger-soft', 'info', 'info-soft', 'focus',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'chart-7', 'chart-8',
  'transparent', 'current', 'inherit',
];

const twMerge = extendTailwindMerge({
  override: {
    theme: {
      color: TOKEN_COLORS,
      // Свои анимации из globals.css: иначе twMerge не видит конфликта, и `animate-none` не отменяет `animate-fade-in`
      animate: ['none', 'spin', 'ping', 'pulse', 'bounce', 'fade-in', 'nav-progress', 'pulse-soft', 'scale-in', 'slide-left', 'slide-right', 'slide-up', 'slide-up-soft', 'shimmer', 'rise', 'pop', 'shake', 'toast-in'],
    },
  },
});

/** Склейка классов: clsx + twMerge. Используется во всех компонентах вместо конкатенации строк. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
