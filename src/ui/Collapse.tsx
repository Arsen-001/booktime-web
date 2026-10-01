'use client';

import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { DURATION, EASE, useMotionPreset, type MotionPreset } from '@/ui/motion';

/** Раскрытие: содержимое проявляется и чуть опускается на место; скрытие — тает. Только opacity и transform */
const COLLAPSE: MotionPreset = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0, transition: { duration: DURATION.normal, ease: EASE.out } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12, ease: EASE.in } },
};

export interface CollapseProps
  extends Pick<ComponentPropsWithoutRef<'div'>, 'id' | 'role' | 'className' | 'aria-label' | 'aria-labelledby'> {
  open: boolean;
  children: ReactNode;
  /** Играть появление и при первом показе уже открытого блока (по умолчанию — нет: страница не «дёргается» при загрузке) */
  animateOnMount?: boolean;
}

/**
 * Сворачиваемый блок: закрытый — не в DOM. Высоту НЕ анимируем (это пересчёт раскладки на каждом кадре — тормозит на
 * слабых телефонах): блок встаёт на место сразу, а его содержимое проявляется. Используется в Accordion; годится для
 * «Показать ещё», дополнительных полей формы, групп фильтров.
 */
export function Collapse({ open, children, animateOnMount = false, ...rest }: CollapseProps) {
  const anim = useMotionPreset(COLLAPSE);
  return (
    <AnimatePresence initial={animateOnMount}>
      {open && (
        <m.div key="collapse" {...anim} {...rest}>
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}
