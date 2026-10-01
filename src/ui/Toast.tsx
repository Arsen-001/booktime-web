'use client';

import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { ConfirmDialog, type ConfirmTone } from '@/ui/ConfirmDialog';
import { IconButton } from '@/ui/IconButton';
import { DURATION, EASE, PRESETS, TRANSITION, useMotionPreset, type MotionPreset } from '@/ui/motion';
import { Portal } from '@/ui/Portal';
import { useExitHold } from '@/ui/hooks/useExitHold';
import { useIsMobile } from '@/ui/hooks/useMediaQuery';
import { useTopOverlay } from '@/ui/hooks/useOverlayStack';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  action?: { label: ReactNode; onClick: () => void };
  /** Сколько держать, мс. По умолчанию 4 с, ошибка — 6 с, с кнопкой — 8 с */
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, 'title' | 'tone' | 'durationMs'>> {
  id: string;
  description?: ReactNode;
  action?: ToastOptions['action'];
}

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  tone?: ConfirmTone;
}

type ConfirmItem = ConfirmOptions & { resolve: (ok: boolean) => void };

interface UiRootStore {
  toasts: ToastItem[];
  confirm: ConfirmItem | null;
  /** Окно подтверждения ещё уходит: следующее ждёт в очереди, а не подменяет текст в уходящем окне */
  closing: boolean;
  queued: ConfirmItem | null;
}

const useUiRoot = create<UiRootStore>(() => ({ toasts: [], confirm: null, closing: false, queued: null }));

let counter = 0;

function show(options: ToastOptions): string {
  counter += 1;
  const id = `toast-${counter}`;
  const tone = options.tone ?? 'info';
  const durationMs = options.durationMs ?? (options.action ? 8000 : tone === 'error' ? 6000 : 4000);
  useUiRoot.setState((s) => ({
    toasts: [
      ...s.toasts.slice(-3),
      { id, tone, durationMs, title: options.title, description: options.description, action: options.action },
    ],
  }));
  return id;
}

function dismiss(id: string): void {
  useUiRoot.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

type ShortOptions = Omit<ToastOptions, 'title' | 'tone'>;

/** Тосты без хука (например, из api-функций). В компонентах удобнее useToast(). */
export const toast = {
  show,
  dismiss,
  success: (title: ReactNode, opts?: ShortOptions) => show({ ...opts, title, tone: 'success' }),
  error: (title: ReactNode, opts?: ShortOptions) => show({ ...opts, title, tone: 'error' }),
  info: (title: ReactNode, opts?: ShortOptions) => show({ ...opts, title, tone: 'info' }),
  warning: (title: ReactNode, opts?: ShortOptions) => show({ ...opts, title, tone: 'warning' }),
};

/**
 * Всплывающие сообщения:
 *   const toast = useToast();
 *   try { await save.mutate(x); toast.success(t('saved')); } catch { toast.error(t('actionFailed')); }
 */
export function useToast() {
  return toast;
}

/**
 * Подтверждение, которое можно дождаться:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Удалить запись?', tone: 'danger' })) { … }
 */
export function useConfirm() {
  return confirmDialog;
}

// Одна функция на всё приложение: хук без хуков внутри React Compiler не запоминает, и новая стрелка на каждый
// рендер меняла все обработчики с confirm (окно записи журнала перерисовывало зоны на каждый ответ «сети»).
function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const { confirm: previous, closing, queued } = useUiRoot.getState();
    // Два подтверждения подряд («Создать без клиента?» → «Вне графика»): второе открывается после ухода первого,
    // а не заменяет его текст в тот же кадр
    if (closing) {
      queued?.resolve(false);
      useUiRoot.setState({ queued: { ...options, resolve } });
      return;
    }
    previous?.resolve(false);
    useUiRoot.setState({ confirm: { ...options, resolve } });
  });
}

const TONE: Record<ToastTone, { icon: LucideIcon; iconClass: string }> = {
  success: { icon: CircleCheck, iconClass: 'bg-success-soft text-success' },
  error: { icon: CircleAlert, iconClass: 'bg-danger-soft text-danger' },
  info: { icon: Info, iconClass: 'bg-info-soft text-info' },
  warning: { icon: TriangleAlert, iconClass: 'bg-warning-soft text-warning' },
};

/**
 * Уход тоста: сначала гаснет и отъезжает вбок, потом его место плавно схлопывается — соседи по стопке съезжают,
 * а не прыгают в первый же кадр после ухода.
 */
const TOAST_EXIT = {
  ...PRESETS.toast.exit,
  height: 0,
  transition: {
    ...TRANSITION.exitFast,
    height: { duration: DURATION.normal, ease: EASE.inOut, delay: DURATION.fast },
  },
};

const TOAST_FROM_BOTTOM: MotionPreset = { ...PRESETS.toast, exit: TOAST_EXIT };

/** Сверху (телефон при открытой шторке) тост выезжает сверху, иначе — снизу */
const TOAST_FROM_TOP: MotionPreset = {
  ...TOAST_FROM_BOTTOM,
  initial: { ...PRESETS.toast.initial, y: -16 },
};

function ToastCard({ item, fromTop }: { item: ToastItem; fromTop: boolean }) {
  const t = useT('ui');
  const anim = useMotionPreset(fromTop ? TOAST_FROM_TOP : TOAST_FROM_BOTTOM);
  const { icon: Icon, iconClass } = TONE[item.tone];
  // Пока курсор над тостом или фокус внутри — не прячем: человек читает или тянется к «Отменить»
  const [paused, setPaused] = useState(false);
  const left = useRef(item.durationMs);

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => dismiss(item.id), left.current);
    return () => {
      clearTimeout(timer);
      left.current = Math.max(1500, left.current - (Date.now() - started));
    };
  }, [item.id, paused]);

  return (
    // Обёртка держит место тоста в стопке (отступ вместо gap — схлопывается вместе с ним)
    <m.div {...anim} className="w-full max-w-sm py-1">
      <div
        role={item.tone === 'error' ? 'alert' : 'status'}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className="pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border border-border bg-surface py-3 pr-2 pl-3 text-fg shadow-lg"
      >
        <span aria-hidden className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', iconClass)}>
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1 py-1">
          <p className="text-[0.9375rem] leading-snug font-semibold">{item.title}</p>
          {item.description && <p className="mt-0.5 text-sm leading-snug text-muted">{item.description}</p>}
          {item.action && (
            <button
              type="button"
              className="mt-1.5 -ml-1 min-h-10 rounded-md px-1 text-sm font-semibold text-primary-text hover:underline"
              onClick={() => {
                item.action?.onClick();
                dismiss(item.id);
              }}
            >
              {item.action.label}
            </button>
          )}
        </div>
        <IconButton
          icon={<X aria-hidden />}
          label={t('close')}
          size="sm"
          onClick={() => dismiss(item.id)}
          className="rounded-full text-muted hover:text-fg"
        />
      </div>
    </m.div>
  );
}

/**
 * Место для тостов и императивного подтверждения. Монтируется ОДИН раз в корневом layout.
 * Телефон — по центру снизу над нижними вкладками и липкой панелью действия; пока открыта шторка или окно — сверху
 * (иначе тост ложится на поля и «Сохранить»). Десктоп — справа снизу; при открытой правой шторке — левее неё.
 */
export function ToastViewport() {
  const toasts = useUiRoot((s) => s.toasts);
  const confirm = useUiRoot((s) => s.confirm);
  const isMobile = useIsMobile();
  const overlay = useTopOverlay();
  const onTop = isMobile && overlay !== null;
  const besideSheet = !isMobile && overlay?.kind === 'sheet' && overlay.side === 'right' && overlay.width;

  const settle = (ok: boolean) => {
    const current = useUiRoot.getState().confirm;
    if (!current) return;
    useUiRoot.setState({ confirm: null, closing: true });
    current.resolve(ok);
  };
  // Уходящее окно держит свой текст до конца анимации
  const shown = useExitHold(confirm);
  const onConfirmExit = () => {
    shown.onExitComplete();
    const { queued } = useUiRoot.getState();
    useUiRoot.setState({ closing: false, queued: null, confirm: queued });
  };

  return (
    <>
      <Portal>
        <div
          aria-live="polite"
          data-toast-viewport={onTop ? 'top' : 'bottom'}
          // Открылась правая шторка — стопка отъезжает левее неё сдвигом (transform), а не скачком `right`:
          // тосты плавно переезжают, и это не сдвиг раскладки
          style={besideSheet ? { transform: `translateX(calc(-1 * ${overlay.width}))` } : undefined}
          className={cn(
            'pointer-events-none fixed inset-x-0 z-[70] flex items-center px-4 md:inset-x-auto md:right-6 md:bottom-6 md:items-end md:px-0',
            'transition-transform duration-[220ms] ease-out motion-reduce:transition-none',
            // Новый тост встаёт дальше от края, у которого стопка прижата: прежние остаются на месте, без скачка
            onTop
              ? 'top-[calc(env(safe-area-inset-top,0px)+0.75rem)] flex-col'
              : 'bottom-[calc(env(safe-area-inset-bottom,0px)+var(--app-bottom-inset)+var(--sticky-bar-h)+var(--bulk-bar-h)+1.5rem)] flex-col-reverse',
          )}
        >
          <AnimatePresence initial={false}>
            {toasts.map((item) => (
              <ToastCard key={item.id} item={item} fromTop={onTop} />
            ))}
          </AnimatePresence>
        </div>
      </Portal>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && settle(false)}
        onExitComplete={onConfirmExit}
        title={shown.value?.title}
        description={shown.value?.description}
        confirmLabel={shown.value?.confirmLabel}
        cancelLabel={shown.value?.cancelLabel}
        tone={shown.value?.tone}
        onConfirm={() => settle(true)}
      />
    </>
  );
}
