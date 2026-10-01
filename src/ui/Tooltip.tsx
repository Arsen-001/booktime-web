'use client';

import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { cloneElement, useId, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { PRESETS, useMotionPreset } from '@/ui/motion';
import { Portal } from '@/ui/Portal';
import { useEscape } from '@/ui/hooks/useEscape';
import { useFloating, type FloatingSide } from '@/ui/hooks/useFloating';

export interface TooltipProps {
  content: ReactNode;
  /** Один элемент (кнопка, иконка с tabIndex) — ему добавится aria-describedby */
  children: ReactElement<{ 'aria-describedby'?: string }>;
  side?: FloatingSide;
  /** Не показывать (подпись и так видна). Обёртка остаётся — один и тот же узел в обоих режимах, без пересоздания */
  disabled?: boolean;
  className?: string;
  classNames?: { anchor?: string };
}

/**
 * Подсказка по наведению мыши и по фокусу с клавиатуры. На касание не реагирует — важное не прячьте
 * только в подсказку.
 */
export function Tooltip({ content, children, side = 'top', disabled = false, className, classNames }: TooltipProps) {
  const [hovered, setOpen] = useState(false);
  const open = hovered && !disabled;
  const anim = useMotionPreset(PRESETS.tooltip);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  const [floating, setFloating] = useState<HTMLDivElement | null>(null);
  const id = useId();

  useFloating({ open, anchor, floating, side, align: 'center', offset: 8 });
  useEscape(open, () => setOpen(false));

  return (
    <>
      <span
        ref={setAnchor}
        data-tooltip-anchor=""
        className={cn('inline-flex', classNames?.anchor)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
      </span>
      <Portal>
        <AnimatePresence>
          {open && (
            <m.div
              {...anim}
              ref={setFloating}
              id={id}
              role="tooltip"
              style={{ position: 'fixed', top: 0, left: 0, visibility: 'hidden' }}
              className={cn(
                'pointer-events-none z-[60] max-w-xs rounded-lg bg-fg px-3 py-2 text-sm leading-snug text-bg shadow-md',
                className,
              )}
            >
              {content}
            </m.div>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}
