'use client';

import { useIsPresent } from 'motion/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface OverlayLayerProps {
  className?: string;
  children: ReactNode;
}

/**
 * Корень окна/шторки внутри AnimatePresence. Пока слой уходит (играет анимация закрытия), он уже «не здесь»:
 * клики проходят насквозь, фокус и скринридер его не видят — страница под ним живая сразу после нажатия «✕».
 */
export function OverlayLayer({ className, children }: OverlayLayerProps) {
  const present = useIsPresent();
  return (
    <div
      className={cn(className, !present && 'pointer-events-none')}
      inert={!present || undefined}
      data-leaving={!present || undefined}
    >
      {children}
    </div>
  );
}
