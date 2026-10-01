'use client';

import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';

const loadFeatures = () => import('@/ui/motionFeatures').then((mod) => mod.default);

/**
 * Motion на всё приложение (монтируется один раз в src/app/providers.tsx).
 * LazyMotion + `m.*`: возможности (domAnimation) приезжают отдельным куском (motionFeatures.ts) — в первый кусок
 * страницы Motion целиком не попадает; strict запрещает тяжёлый `motion.*`.
 * reducedMotion="user": при «уменьшить движение» в системе Motion сам гасит сдвиги и масштаб, оставляя прозрачность.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
