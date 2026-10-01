import { cn } from '@/lib/cn';

export interface StepDotsProps {
  total: number;
  /** Текущий шаг, с 0 */
  current: number;
  className?: string;
}

/** Точки прогресса тура: текущая — вытянутая «таблетка» primary, пройденные — primary, будущие — серые */
export function StepDots({ total, current, className }: StepDotsProps) {
  return (
    <span aria-hidden className={cn('inline-flex items-center gap-1.5', className)}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out',
            i === current ? 'w-5 bg-primary' : i < current ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-surface-3',
          )}
        />
      ))}
    </span>
  );
}
