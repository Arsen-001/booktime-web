'use client';

import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useId, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { PRESETS, useMotionPreset } from '@/ui/motion';
import { useExitHold } from '@/ui/hooks/useExitHold';
import { Portal } from '@/ui/Portal';
import { useEscape } from '@/ui/hooks/useEscape';
import { useFloating, type FloatingSide } from '@/ui/hooks/useFloating';

/** Задержка перед показом по наведению, мс: подсказка не мелькает, когда мышь просто проходит мимо */
const HOVER_DELAY = 350;

export interface TipHandlers {
  onPointerEnter: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: PointerEvent<HTMLElement>) => void;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
  onBlur: (e: FocusEvent<HTMLElement>) => void;
}

export interface UseTipOptions {
  side?: FloatingSide;
  /** Не показывать (например, подпись и так видна рядом) */
  disabled?: boolean;
}

export interface UseTip {
  /** Обработчики на элемент-якорь; пользовательские обработчики склеивайте через mergeTipHandlers */
  handlers: TipHandlers;
  /** id открытой подсказки — для aria-describedby, если подпись не дублирует aria-label */
  tipId: string | undefined;
  /** Слой подсказки: отрисуйте рядом с элементом */
  tip: ReactNode;
}

/**
 * НАША всплывающая подсказка вместо системного `title="…"` (он запрещён: жёлтый квадрат браузера, на касание не
 * работает, выглядит чужим). Без обёртки вокруг элемента — вёрстка кнопки не меняется (ml-auto, md:hidden и т. п.
 * продолжают работать). Показ: наведение мыши (с задержкой) и фокус с клавиатуры; касание не открывает.
 */
export function useTip(content: ReactNode, { side = 'top', disabled = false }: UseTipOptions = {}): UseTip {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [floating, setFloating] = useState<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();
  const open = anchor !== null && !disabled && content !== undefined && content !== null && content !== '';

  useFloating({ open, anchor, floating, side, align: 'center', offset: 8 });
  useEscape(open, () => setAnchor(null));

  useEffect(() => () => clearTimeout(timer.current), []);

  const clear = () => clearTimeout(timer.current);
  const hide = () => {
    clear();
    setAnchor(null);
  };

  // Элемент уже внутри <Tooltip> со своим текстом — вторую подсказку не показываем
  const wrapped = (el: HTMLElement) => Boolean(el.parentElement?.closest('[data-tooltip-anchor]'));

  const handlers: TipHandlers = {
    onPointerEnter: (e) => {
      if (e.pointerType !== 'mouse' || wrapped(e.currentTarget)) return;
      const el = e.currentTarget;
      clear();
      timer.current = setTimeout(() => setAnchor(el), HOVER_DELAY);
    },
    onPointerLeave: hide,
    onPointerDown: hide,
    onFocus: (e) => {
      // Только фокус с клавиатуры: после клика мышью подсказка не нужна
      if (e.currentTarget.matches(':focus-visible') && !wrapped(e.currentTarget)) setAnchor(e.currentTarget);
    },
    onBlur: hide,
  };

  // Подсказка гаснет плавно: слой живёт, пока идёт уход (у каждой кнопки — только пока подсказка видна)
  const hold = useExitHold(open || undefined);
  const anim = useMotionPreset(PRESETS.tooltip);
  const tip = hold.mounted ? (
    <Portal>
      <AnimatePresence onExitComplete={hold.onExitComplete}>
        {open && (
          <m.div
            {...anim}
            ref={setFloating}
            id={id}
            role="tooltip"
            style={{ position: 'fixed', top: 0, left: 0, visibility: 'hidden' }}
            className={cn(
              'pointer-events-none z-[70] max-w-xs rounded-lg bg-fg px-2.5 py-1.5 text-[13px] leading-snug font-medium text-bg shadow-md',
            )}
          >
            {content}
          </m.div>
        )}
      </AnimatePresence>
    </Portal>
  ) : null;

  return { handlers, tipId: open ? id : undefined, tip };
}

type AnyHandler<E> = ((e: E) => void) | undefined;

/** Склеить обработчики подсказки с обработчиками, которые передал раздел (вызываются оба) */
export function mergeTipHandlers<T extends Partial<Record<keyof TipHandlers, unknown>>>(
  tip: TipHandlers,
  own: T,
): TipHandlers {
  const call =
    <E,>(a: (e: E) => void, b: unknown) =>
    (e: E) => {
      a(e);
      (b as AnyHandler<E>)?.(e);
    };
  return {
    onPointerEnter: call(tip.onPointerEnter, own.onPointerEnter),
    onPointerLeave: call(tip.onPointerLeave, own.onPointerLeave),
    onPointerDown: call(tip.onPointerDown, own.onPointerDown),
    onFocus: call(tip.onFocus, own.onFocus),
    onBlur: call(tip.onBlur, own.onBlur),
  };
}
