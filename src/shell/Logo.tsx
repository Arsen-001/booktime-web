import Link from 'next/link';
import { cn } from '@/lib/cn';
import { BrandMark } from './BrandMark';

export interface LogoProps {
  href?: string;
  /** Подпись под названием (например, «Кабинет бизнеса») */
  caption?: string;
  compact?: boolean;
  className?: string;
}

/** Знак продукта. Имя продукта «BookTime», домен booktime.am — выбрано владельцем 26.09.2026 (В-35, F-00-208) — меняется здесь и в common.app.name */
export function Logo({ href = '/', caption, compact, className }: LogoProps) {
  return (
    <Link
      href={href}
      aria-label={compact ? 'BookTime' : undefined}
      className={cn(
        'flex min-h-11 min-w-11 items-center justify-center gap-2.5 rounded-lg transition-opacity hover:opacity-90',
        !compact && 'justify-start',
        className,
      )}
    >
      {/* Знак BookTime — монограмма BT из клеток календаря (выбран владельцем 01.10.2026) */}
      <span aria-hidden className="grid size-10 shrink-0 place-items-center">
        <BrandMark className="h-8 w-auto" />
      </span>
      {!compact && (
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-lg font-bold tracking-tight text-fg">BookTime</span>
          {caption && <span className="truncate text-xs text-muted">{caption}</span>}
        </span>
      )}
    </Link>
  );
}
