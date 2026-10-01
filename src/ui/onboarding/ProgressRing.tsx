import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ProgressRingSize = 'sm' | 'md' | 'lg';

const SIZE: Record<ProgressRingSize, { box: string; px: number; stroke: number; text: string }> = {
  sm: { box: 'size-10', px: 40, stroke: 4, text: 'text-xs' },
  md: { box: 'size-14', px: 56, stroke: 5, text: 'text-sm' },
  lg: { box: 'size-20', px: 80, stroke: 6, text: 'text-base' },
};

export interface ProgressRingProps {
  done: number;
  total: number;
  size?: ProgressRingSize;
  /** Подпись для скринридера, например «Выполнено 3 из 5» */
  label?: string;
  className?: string;
}

/** Кольцо прогресса «3/5» для чек-листа первых шагов; всё сделано — зелёная галочка */
export function ProgressRing({ done, total, size = 'md', label, className }: ProgressRingProps) {
  const s = SIZE[size];
  const r = (s.px - s.stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const complete = total > 0 && done >= total;

  return (
    <span
      role="img"
      aria-label={label ?? `${done}/${total}`}
      className={cn('relative inline-flex shrink-0 items-center justify-center', s.box, className)}
    >
      <svg viewBox={`0 0 ${s.px} ${s.px}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={s.px / 2} cy={s.px / 2} r={r} fill="none" strokeWidth={s.stroke} className="stroke-surface-3" />
        <circle
          cx={s.px / 2}
          cy={s.px / 2}
          r={r}
          fill="none"
          strokeWidth={s.stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className={cn(
            'transition-[stroke-dashoffset] duration-500 ease-out',
            complete ? 'stroke-success' : 'stroke-primary',
          )}
        />
      </svg>
      {complete ? (
        <Check aria-hidden className="relative size-1/2 text-success" strokeWidth={3} />
      ) : (
        <span className={cn('nums relative font-semibold text-fg', s.text)}>
          {done}/{total}
        </span>
      )}
    </span>
  );
}
