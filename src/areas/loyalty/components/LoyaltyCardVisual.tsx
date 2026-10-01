import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface LoyaltyCardVisualProps {
  number: string;
  holderName: string;
  typeName: string;
  className?: string;
}

/**
 * Карта лояльности как настоящая банковская карта (F-06-059, ТЗ владельца: «карта — красиво, как в банке»):
 * градиент из токенов бренда, замаскированный номер, имя владельца. Только градиент/картинка — без анимации
 * и box-shadow с blur (DESIGN.md → Performance): статичный shadow-lg, без наведения.
 */
export function LoyaltyCardVisual({ number, holderName, typeName, className }: LoyaltyCardVisualProps) {
  const tail = number.replace(/\s+/g, '').slice(-4).padStart(4, '0');
  const masked = `•••• •••• •••• ${tail}`;

  return (
    <div
      className={cn('relative isolate w-full max-w-sm overflow-hidden rounded-2xl px-5 py-5 shadow-lg sm:px-6 sm:py-6', className)}
      style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)' }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 140% at 100% -10%, white 0%, transparent 55%)', opacity: 0.14 }}
      />
      <div className="relative flex items-start justify-between gap-3 text-primary-contrast">
        <span className="text-[11px] font-semibold tracking-[2.5px] uppercase opacity-80">{typeName}</span>
        <Sparkles aria-hidden className="size-5 opacity-80" />
      </div>

      <div
        aria-hidden
        className="relative mt-6 h-6 w-9 rounded-[6px]"
        style={{ background: 'color-mix(in srgb, white 30%, transparent)' }}
      />

      <p className="relative mt-4 text-xl font-semibold tracking-[2px] text-primary-contrast tabular-nums sm:text-2xl">{masked}</p>

      <p className="relative mt-5 truncate text-sm font-medium text-primary-contrast opacity-90">{holderName}</p>
    </div>
  );
}
