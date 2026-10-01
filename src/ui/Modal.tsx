'use client';

import { X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useId, useRef, type ReactNode } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';
import { PRESETS, useMotionPreset } from '@/ui/motion';
import { OverlayLayer } from '@/ui/parts/OverlayLayer';
import { Portal } from '@/ui/Portal';
import { useEscape } from '@/ui/hooks/useEscape';
import { useFocusTrap } from '@/ui/hooks/useFocusTrap';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { useRegisterOverlay } from '@/ui/hooks/useOverlayStack';
import { useScrollLock } from '@/ui/hooks/useScrollLock';
import { OverlayPresenceContext, useOverlayPresence } from '@/ui/hooks/useExitHold';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Кнопки внизу (прилипают к низу при прокрутке) */
  footer?: ReactNode;
  size?: ModalSize;
  /** Спрятать крестик в шапке */
  hideClose?: boolean;
  /** Не закрывать по клику на затемнение (например, форма с несохранёнными данными) */
  dismissible?: boolean;
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

const SIZE: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

/**
 * Модальное окно: на десктопе по центру, на телефоне — прижато к низу (кнопки под большим пальцем,
 * как шторка), кнопки подвала на всю ширину. Закрытое — не в DOM. Портал в body, фокус внутри, Esc и клик по
 * затемнению закрывают, прокрутка страницы заблокирована, фокус возвращается на кнопку-открыватель.
 */
export function Modal({
  open: openProp,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideClose = false,
  dismissible = true,
  className,
  classNames,
  onExitComplete: onExitCompleteProp,
}: ModalProps) {
  // Внутри <ExitHold> окно закрывается и по нему (обёртка с `open` всегда true уходит плавно)
  const presence = useOverlayPresence(openProp, onExitCompleteProp);
  const open = presence.open;
  const t = useT('ui');
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  const isMobile = useIsMobile();

  useScrollLock(open);
  // Кнопка с data-autofocus (ConfirmDialog) — как раньше; иначе фокус на окне, а не на «✕» в углу
  useFocusTrap(panelRef, open, { initialFocus: hideClose ? 'first' : 'container' });
  useEscape(open, () => onOpenChange(false));
  useRegisterOverlay(open, { kind: 'modal', side: isMobile ? 'bottom' : undefined });
  const backdrop = useMotionPreset(PRESETS.backdrop);
  const panel = useMotionPreset(isMobile ? PRESETS.slideUp : PRESETS.dialog);

  return (
    <Portal>
      <AnimatePresence onExitComplete={presence.onExitComplete}>
        {open && (
          <OverlayLayer
            key="modal"
            className={cn('fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6', className)}
          >
            {/* Окна внутри этого окна не закрываются вместе с внешним <ExitHold> — у них свой open */}
            <OverlayPresenceContext.Provider value={null}>
              <m.div
                {...backdrop}
                aria-hidden
                className="absolute inset-0 bg-overlay"
                onClick={() => dismissible && onOpenChange(false)}
              />
              <m.div
                {...panel}
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={cn(
                  'relative flex max-h-[92dvh] w-full flex-col overflow-hidden border border-border bg-surface text-fg shadow-lg outline-none',
                  'rounded-t-2xl pb-safe sm:rounded-2xl sm:pb-0',
                  SIZE[size],
                  classNames?.panel,
                )}
              >
                <div aria-hidden className="flex justify-center pt-2.5 sm:hidden">
                  <span className="h-1.5 w-10 rounded-full bg-surface-3" />
                </div>
                <div className={cn('flex items-start gap-3 px-5 pt-3 pb-3 sm:px-6 sm:pt-5', classNames?.header)}>
                  <div className="min-w-0 flex-1 pt-1.5">
                    <h2 id={titleId} className="text-lg leading-snug font-semibold tracking-tight sm:text-xl">
                      {title}
                    </h2>
                    {description && (
                      <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted">
                        {description}
                      </p>
                    )}
                  </div>
                  {!hideClose && (
                    <IconButton
                      icon={<X aria-hidden />}
                      label={t('close')}
                      onClick={() => onOpenChange(false)}
                      className="-mt-1 -mr-2 rounded-full text-muted hover:text-fg"
                    />
                  )}
                </div>
                <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 scrollbar-thin', classNames?.body)}>
                  {children}
                </div>
                {footer && (
                  <div
                    className={cn(
                      'flex flex-col-reverse gap-2 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-6',
                      '[&>*]:w-full sm:[&>*]:w-auto',
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
