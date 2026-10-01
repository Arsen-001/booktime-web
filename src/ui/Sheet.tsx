'use client';

import { X } from 'lucide-react';
import { AnimatePresence, useMotionValue, type MotionValue } from 'motion/react';
import * as m from 'motion/react-m';
import { useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';
import { DURATION, PRESETS, useMotionPreset, type MotionPreset } from '@/ui/motion';
import { OverlayLayer } from '@/ui/parts/OverlayLayer';
import { Portal } from '@/ui/Portal';
import { useEscape } from '@/ui/hooks/useEscape';
import { useFocusTrap } from '@/ui/hooks/useFocusTrap';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { useRegisterOverlay } from '@/ui/hooks/useOverlayStack';
import { useScrollLock } from '@/ui/hooks/useScrollLock';
import { OverlayPresenceContext, useOverlayPresence } from '@/ui/hooks/useExitHold';

export type SheetSide = 'auto' | 'bottom' | 'right' | 'left';
export type SheetSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** auto — снизу на телефоне, справа на десктопе */
  side?: SheetSide;
  /** Ширина боковой шторки */
  size?: SheetSize;
  children?: ReactNode;
  footer?: ReactNode;
  hideClose?: boolean;
  /** Кнопки в шапке рядом с «✕» — например, меню «⋯» с опасным действием (в подвале на телефоне — не больше двух кнопок) */
  headerActions?: ReactNode;
  /**
   * false — без затемнения и без ловушки фокуса: страница за шторкой видна и нажимается (панель, которая правит то,
   * что за ней, — предпросмотр в таблице). Только на десктопе: на телефоне шторка всегда модальная.
   */
  modal?: boolean;
  /** Заголовок только для скринридера (например, меню действий на телефоне) */
  srOnlyTitle?: boolean;
  /** Уход закончился (окно уже не в DOM) — для useExitHold: снять условие, которым окно смонтировано */
  onExitComplete?: () => void;
  className?: string;
  classNames?: {
    panel?: string;
    header?: string;
    body?: string;
    footer?: string;
  };
}

const WIDTH: Record<SheetSize, string> = {
  sm: 'sm:w-[24rem]',
  md: 'sm:w-[30rem]',
  lg: 'sm:w-[42rem]',
  xl: 'sm:w-[min(60rem,calc(100vw-5rem))]',
};

/** Та же ширина для тостов: встают левее открытой шторки */
const WIDTH_CSS: Record<SheetSize, string> = {
  sm: '24rem',
  md: '30rem',
  lg: '42rem',
  xl: 'min(60rem, calc(100vw - 5rem))',
};

type ResolvedSide = Exclude<SheetSide, 'auto'>;

const PANEL: Record<ResolvedSide, string> = {
  bottom: 'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl pb-safe',
  right: 'inset-y-0 right-0 h-dvh w-full max-w-[100vw] rounded-l-2xl',
  left: 'inset-y-0 left-0 h-dvh w-full max-w-[100vw] rounded-r-2xl',
};

const MOTION: Record<ResolvedSide, MotionPreset> = {
  bottom: PRESETS.slideUp,
  right: PRESETS.slideInRight,
  left: PRESETS.slideInLeft,
};

/** Вернуть шторку на место после недотянутого жеста: короткий rAF-доводчик (без перерисовок React) */
function settleBack(y: MotionValue<number>): void {
  const from = y.get();
  if (!from) return;
  const start = performance.now();
  const ms = DURATION.normal * 1000;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    y.set(from * (1 - t) ** 3);
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Насколько (px) потянуть шторку вниз, чтобы она закрылась */
const DRAG_CLOSE_PX = 96;

/**
 * Шторка: снизу на телефоне (с ручкой, прокрутка внутри; потянуть за ручку или шапку вниз — закрыть),
 * сбоку на десктопе. Закрытая — не в DOM (после анимации ухода). Выезд и уход — Motion (пружина из motion.ts);
 * жест тянет шторку через MotionValue — без перерисовок React на каждом движении пальца.
 */
export function Sheet({
  open: openProp,
  onOpenChange,
  title,
  description,
  side = 'auto',
  size = 'md',
  children,
  footer,
  hideClose = false,
  headerActions,
  modal = true,
  srOnlyTitle = false,
  className,
  classNames,
  onExitComplete: onExitCompleteProp,
}: SheetProps) {
  // Внутри <ExitHold> окно закрывается и по нему (обёртка с `open` всегда true уходит плавно)
  const presence = useOverlayPresence(openProp, onExitCompleteProp);
  const open = presence.open;
  const t = useT('ui');
  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const resolved: ResolvedSide = side === 'auto' ? (isMobile ? 'bottom' : 'right') : side;
  const dragY = useMotionValue(0);
  const drag = useRef<{ startY: number; startT: number; id: number } | null>(null);

  // Жест «смахнуть вниз» — только у нижней шторки и только за ручку/шапку (не мешает прокрутке тела)
  const onDragStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (resolved !== 'bottom') return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    drag.current = { startY: e.clientY, startT: e.timeStamp, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    dragY.set(Math.max(0, e.clientY - drag.current.startY));
  };
  const onDragEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const dy = Math.max(0, e.clientY - d.startY);
    const velocity = dy / Math.max(1, e.timeStamp - d.startT);
    // Закрываем — шторка уезжает вниз с того места, где её отпустили (exit продолжает от dragY)
    if (dy > DRAG_CLOSE_PX || (dy > 24 && velocity > 0.6)) onOpenChange(false);
    else settleBack(dragY);
  };
  const dragHandlers =
    resolved === 'bottom'
      ? {
          onPointerDown: onDragStart,
          onPointerMove: onDragMove,
          onPointerUp: onDragEnd,
          onPointerCancel: onDragEnd,
        }
      : {};

  // Немодальная — только сбоку на десктопе; снизу на телефоне шторка закрывает экран всегда
  const isModal = modal || resolved === 'bottom';
  useScrollLock(open && isModal);
  // Фокус — на саму шторку, а не на «✕»: иначе при открытии первым бросается в глаза кольцо вокруг крестика
  useFocusTrap(panelRef, open && isModal, { initialFocus: hideClose ? 'first' : 'container' });
  useEscape(open, () => onOpenChange(false));
  useRegisterOverlay(open, {
    kind: 'sheet',
    side: resolved,
    width: resolved === 'bottom' ? undefined : WIDTH_CSS[size],
  });

  const backdrop = useMotionPreset(PRESETS.backdrop);
  const panel = useMotionPreset(MOTION[resolved]);

  return (
    <Portal>
      <AnimatePresence onExitComplete={presence.onExitComplete}>
        {open && (
          <OverlayLayer
            key="sheet"
            className={cn('fixed inset-0 z-50', !isModal && 'pointer-events-none', className)}
          >
            {/* Окна внутри этого окна не закрываются вместе с внешним <ExitHold> — у них свой open */}
            <OverlayPresenceContext.Provider value={null}>
              {isModal && (
                <m.div
                  {...backdrop}
                  aria-hidden
                  className="absolute inset-0 bg-overlay"
                  onClick={() => onOpenChange(false)}
                />
              )}
              <m.div
                {...panel}
                ref={panelRef}
                role="dialog"
                aria-modal={isModal ? 'true' : undefined}
                data-sheet-side={resolved}
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                style={resolved === 'bottom' ? { y: dragY } : undefined}
                className={cn(
                  'pointer-events-auto absolute flex flex-col border border-border bg-surface text-fg shadow-lg outline-none',
                  PANEL[resolved],
                  resolved !== 'bottom' && WIDTH[size],
                  classNames?.panel,
                )}
              >
                <div
                  {...dragHandlers}
                  className={cn(resolved === 'bottom' && 'cursor-grab touch-none active:cursor-grabbing')}
                >
                  {resolved === 'bottom' && (
                    <div aria-hidden className="flex justify-center pt-2.5 pb-1">
                      <span className="h-1.5 w-10 rounded-full bg-border-strong/40" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex items-start gap-3 px-5 pt-3 pb-3',
                      resolved !== 'bottom' && 'pt-5',
                      classNames?.header,
                    )}
                  >
                    <div className="min-w-0 flex-1 pt-1.5">
                      <h2
                        id={titleId}
                        className={cn(
                          'text-lg leading-snug font-semibold tracking-tight sm:text-xl',
                          srOnlyTitle && 'sr-only',
                        )}
                      >
                        {title}
                      </h2>
                      {description && (
                        <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted">
                          {description}
                        </p>
                      )}
                    </div>
                    {headerActions && <div className="-mt-1 flex shrink-0 items-center gap-1">{headerActions}</div>}
                    {!hideClose && (
                      <IconButton
                        icon={<X aria-hidden />}
                        label={t('close')}
                        onClick={() => onOpenChange(false)}
                        className="-mt-1 -mr-2 rounded-full text-muted hover:text-fg"
                      />
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    // @container — раскладка внутри считается от ширины шторки, а не экрана (@md:grid-cols-2 и т. п.)
                    '@container min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 scrollbar-thin',
                    classNames?.body,
                  )}
                >
                  {children}
                </div>
                {footer && (
                  <div
                    className={cn(
                      'flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end',
                      // Телефон: кнопки на всю ширину столбиком; если раздел завернул их в свой ряд — ряд переносится, а не
                      // выпускает последнюю кнопку за край
                      resolved === 'bottom' && '[&>*]:w-full [&>div]:flex-wrap [&>div>*]:grow',
                      classNames?.footer,
                    )}
                  >
                    {footer}
                  </div>
                )}
              </m.div>
            </OverlayPresenceContext.Provider>
          </OverlayLayer>
        )}
      </AnimatePresence>
    </Portal>
  );
}
