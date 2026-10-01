'use client';

import { cn } from '@/lib/cn';
import { useOnce, type OnceOptions } from '@/ui/onboarding/onboardingStore';

export type BeaconPlacement = 'top-right' | 'top-left' | 'inline';

const PLACEMENT: Record<BeaconPlacement, string> = {
  'top-right': 'absolute -top-1 -right-1',
  'top-left': 'absolute -top-1 -left-1',
  inline: 'relative',
};

export interface BeaconProps {
  /**
   * Ключ «показать один раз»: точка гаснет навсегда, когда вызван `markSeen` этого ключа (обычно — при первом
   * нажатии на кнопку, к которой она прикреплена: `useOnce('beacon.<id>').markSeen()`), либо сразу через `seen`.
   */
  id?: string;
  scope?: OnceOptions['scope'];
  /** Управление снаружи: true — не показывать */
  seen?: boolean;
  /** Родитель должен быть relative (для top-right / top-left) */
  placement?: BeaconPlacement;
  /** Подпись для скринридера: «Новое» */
  label?: string;
  className?: string;
}

/**
 * Пульсирующая точка «загляните сюда» на кнопке или пункте меню — для новой функции или следующего шага.
 * Тихая замена туру: не перекрывает экран. Не больше одной на экран.
 */
export function Beacon({ id, scope, seen, placement = 'top-right', label, className }: BeaconProps) {
  const once = useOnce(`beacon.${id ?? '_'}`, { scope });
  if (seen || (id && (!once.ready || once.seen))) return null;

  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-beacon={id}
      className={cn('pointer-events-none inline-flex size-3', PLACEMENT[placement], className)}
    >
      <span className="absolute inline-flex size-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
      <span className="relative inline-flex size-3 rounded-full bg-accent ring-2 ring-surface" />
    </span>
  );
}
