'use client';

import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useId, useState, type ReactNode, type RefCallback } from 'react';
import { cn } from '@/lib/cn';
import { PRESETS, useMotionPreset } from '@/ui/motion';
import { Portal } from '@/ui/Portal';
import { Sheet } from '@/ui/Sheet';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { useClickOutside } from '@/ui/hooks/useClickOutside';
import { useEscape } from '@/ui/hooks/useEscape';
import { useFloating, type FloatingAlign, type FloatingSide } from '@/ui/hooks/useFloating';

/** Свойства, которые нужно разложить на кнопку-открыватель */
export interface PopoverTriggerProps {
  ref: RefCallback<HTMLElement>;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'dialog' | 'menu' | 'listbox';
  'aria-controls': string | undefined;
}

export interface PopoverProps {
  /** Кнопка-открыватель: trigger={(p) => <Button {...p}>Открыть</Button>} */
  trigger: (props: PopoverTriggerProps) => ReactNode;
  /** Содержимое; функцией — получает close() */
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: FloatingAlign;
  side?: FloatingSide;
  /** Ширина не меньше кнопки */
  matchWidth?: boolean;
  /** Роль для aria-haspopup и контейнера */
  role?: 'dialog' | 'menu' | 'listbox';
  /** Подпись контейнера для скринридера; в режиме шторки — её заголовок */
  label?: string;
  /**
   * Как открываться на телефоне: popover — панелью у кнопки (по умолчанию), sheet — нижней шторкой (удобно, когда
   * внутри кнопки, список или форма: на 390 px панель шириной 300 px висит посреди экрана и упирается в края)
   */
  mobile?: 'popover' | 'sheet';
  className?: string;
}

/**
 * Всплывающая панель у кнопки: портал в body, z-[60], закрывается по Esc и клику вне,
 * переворачивается у края экрана. Появляется из точки у кнопки и так же уходит (Motion, 150 мс; transform/opacity).
 */
export function Popover({
  trigger,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  align = 'start',
  side = 'bottom',
  matchWidth = false,
  role = 'dialog',
  label,
  mobile = 'popover',
  className,
}: PopoverProps) {
  const [inner, setInner] = useState(defaultOpen);
  const open = openProp ?? inner;
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [floating, setFloating] = useState<HTMLDivElement | null>(null);
  const id = useId();
  const isMobile = useIsMobile();
  const asSheet = mobile === 'sheet' && isMobile;

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInner(next);
    onOpenChange?.(next);
  };
  const close = () => setOpen(false);

  useFloating({ open: open && !asSheet, anchor, floating, side, align, matchWidth });
  useEscape(open && !asSheet, () => {
    close();
    anchor?.focus();
  });
  // В режиме шторки клик внутри неё — «снаружи» кнопки; шторка закрывается сама (затемнение, Esc, ✕)
  // Нажатие в ДРУГОЙ панели (Select или период внутри этой панели — их списки в своём портале) — не «снаружи»:
  // иначе выбор значения в фильтре закрывал бы всю панель «Фильтры»
  useClickOutside(
    [anchor, floating],
    (event) => {
      if (event.target instanceof Element && event.target.closest('[data-popover-panel]')) return;
      close();
    },
    open && !asSheet,
  );
  const anim = useMotionPreset(PRESETS.popover);

  return (
    <>
      {trigger({
        ref: setAnchor,
        onClick: () => setOpen(!open),
        'aria-expanded': open,
        'aria-haspopup': role,
        'aria-controls': open ? id : undefined,
      })}
      {asSheet && (
        <Sheet
          open={open}
          onOpenChange={setOpen}
          side="bottom"
          title={label ?? ''}
          srOnlyTitle={!label}
          classNames={{ body: cn('pb-4', role === 'menu' && 'px-3') }}
        >
          <div id={id}>{typeof children === 'function' ? children({ close }) : children}</div>
        </Sheet>
      )}
      <Portal>
        <AnimatePresence>
          {open && !asSheet && (
            <m.div
              {...anim}
              ref={setFloating}
              id={id}
              data-popover-panel=""
              role={role === 'dialog' ? 'dialog' : undefined}
              aria-label={label}
              style={{ position: 'fixed', top: 0, left: 0, visibility: 'hidden' }}
              className={cn(
                'z-[60] min-w-[12rem] max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface p-2 text-fg shadow-lg scrollbar-thin',
                // Панель у кнопки растёт из её стороны (useFloating ставит data-side)
                'origin-top data-[side=top]:origin-bottom data-[side=left]:origin-right data-[side=right]:origin-left',
                className,
              )}
            >
              {typeof children === 'function' ? children({ close }) : children}
            </m.div>
          )}
        </AnimatePresence>
      </Portal>
    </>
  );
}
