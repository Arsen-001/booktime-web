'use client';

/**
 * Показ презентации на весь экран: Fullscreen API (если браузер не даёт — например, Safari на iPhone, — тот же слой
 * просто закрывает всё окно). Листать: ← → / пробел / PageUp-PageDown / Home-End, касание левой или правой части
 * слайда, свайп. Выход — Esc или ✕. Смена слайда — растворение (как в макете); при prefers-reduced-motion
 * useMotionPreset сам делает её мгновенной.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence } from 'motion/react';
import * as m from 'motion/react-m';
import { ChevronLeft, ChevronRight, RotateCw, X } from 'lucide-react';
import type { PitchDeckTexts } from '@/areas/platform/pitch/decks.server';
import { SLIDE_IDS, SLIDE_PALETTE, Slide, SlideFrame } from '@/areas/platform/pitch/slides';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { IconButton } from '@/ui/IconButton';
import { Portal } from '@/ui/Portal';
import { useFocusTrap } from '@/ui/hooks/useFocusTrap';
import { useScrollLock } from '@/ui/hooks/useScrollLock';
import { PRESETS, useMotionPreset } from '@/ui/motion';

type FullscreenDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FullscreenEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> };

function fullscreenElement(): Element | null {
  const doc = document as FullscreenDoc;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/**
 * Вызывать прямо в обработчике нажатия (жест пользователя): открывает весь документ на весь экран, слой показа
 * сверху. Не вышло — ничего страшного, слой и так на всё окно.
 */
export async function enterFullscreen(): Promise<void> {
  const el = document.documentElement as FullscreenEl;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return;
    // Телефон в портрете — повернуть в альбомную, где это разрешено (Android Chrome на весь экран)
    await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape').catch(() => undefined);
  } catch {
    // Браузер не дал — показываем в слое на всё окно
  }
}

function exitFullscreen(): void {
  if (!fullscreenElement()) return;
  const doc = document as FullscreenDoc;
  try {
    screen.orientation?.unlock?.();
  } catch {
    // нечего разблокировать
  }
  void (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.())?.catch?.(() => undefined);
}

/** Кнопки и подсказка прячутся, когда мышь не двигается (на телефоне — после касаний) */
const IDLE_MS = 2500;
/** Сдвиг пальца, после которого это свайп, а не касание */
const SWIPE_PX = 48;

export interface PresentModeProps {
  deck: PitchDeckTexts;
  start: number;
  contact?: string;
  onClose: () => void;
}

export function PresentMode({ deck, start, contact, onClose }: PresentModeProps) {
  const t = useT('platform');
  const total = SLIDE_IDS.length;
  const [index, setIndex] = useState(() => Math.min(Math.max(start, 0), total - 1));
  const [controls, setControls] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  const fade = useMotionPreset(PRESETS.fade);

  useScrollLock(true);
  useFocusTrap(rootRef, true, { initialFocus: 'container' });

  const go = useCallback((delta: number) => setIndex((i) => Math.min(Math.max(i + delta, 0), total - 1)), [total]);

  const close = useCallback(() => {
    exitFullscreen();
    onClose();
  }, [onClose]);

  const wake = useCallback(() => {
    setControls(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setControls(false), IDLE_MS);
  }, []);

  useEffect(() => {
    idleTimer.current = window.setTimeout(() => setControls(false), IDLE_MS);
    return () => window.clearTimeout(idleTimer.current);
  }, []);

  // Вышли из полноэкранного режима сами (Esc браузера, жест) — закрываем и показ
  useEffect(() => {
    let wasFullscreen = !!fullscreenElement();
    const onChange = () => {
      const now = !!fullscreenElement();
      if (wasFullscreen && !now) onClose();
      wasFullscreen = now;
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // Пробел/Enter на кнопке — это нажатие кнопки, а не «дальше»
      const onButton = e.target instanceof HTMLElement && e.target.closest('button');
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault();
          go(1);
          break;
        case ' ':
        case 'Enter':
          if (onButton) return;
          e.preventDefault();
          go(e.shiftKey ? -1 : 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
        case 'Backspace':
          e.preventDefault();
          go(-1);
          break;
        case 'Home':
          e.preventDefault();
          setIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setIndex(total - 1);
          break;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          close();
          break;
        default:
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, close, total]);

  const onPointerDown = (e: ReactPointerEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const startAt = pointer.current;
    pointer.current = null;
    wake();
    if (!startAt || (e.target instanceof Element && e.target.closest('button'))) return;
    const dx = e.clientX - startAt.x;
    const dy = e.clientY - startAt.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
      return;
    }
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
    // Касание: левая треть экрана — назад, остальное — дальше
    go(e.clientX < window.innerWidth / 3 ? -1 : 1);
  };

  const id = SLIDE_IDS[index];
  const progress = ((index + 1) / total) * 100;
  const counter = t('pitch.counter', { n: index + 1, total });

  return (
    <Portal>
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('pitch.presentation')}
        tabIndex={-1}
        data-pitch-present=""
        style={SLIDE_PALETTE}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse') wake();
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointer.current = null;
        }}
        className={cn('fixed inset-0 z-[200] flex touch-none items-center justify-center bg-(--pt-dark) outline-none', !controls && 'cursor-none')}
      >
        {/* Прогресс показа */}
        <div className="absolute inset-x-0 top-0 z-10 h-1 bg-primary-contrast/15" aria-hidden>
          <div
            className="h-full bg-primary-contrast/80 transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Слайд; касание и свайп по всему слою листают */}
        <div className="relative w-[min(100vw,calc(100dvh*16/9))] select-none">
          <SlideFrame>
            <AnimatePresence initial={false}>
              <m.div key={id} {...fade} className="absolute inset-0">
                <Slide id={id} d={deck} n={index + 1} contact={contact} />
              </m.div>
            </AnimatePresence>
          </SlideFrame>
        </div>

        {/* Закрыть */}
        <IconButton
          icon={<X aria-hidden />}
          label={t('pitch.exit')}
          variant="secondary"
          onClick={close}
          className={cn(
            'absolute top-3 right-3 z-10 border-transparent bg-primary-contrast/10 text-primary-contrast transition-opacity duration-200 hover:bg-primary-contrast/20 motion-reduce:transition-none',
            !controls && 'pointer-events-none opacity-0',
          )}
        />

        {/* Листать и счётчик */}
        <div
          className={cn(
            'absolute right-3 bottom-3 z-10 flex items-center gap-1 rounded-full bg-primary-contrast/10 p-1 text-primary-contrast transition-opacity duration-200 motion-reduce:transition-none',
            !controls && 'pointer-events-none opacity-0',
          )}
        >
          <IconButton
            icon={<ChevronLeft aria-hidden />}
            label={t('pitch.prev')}
            onClick={() => go(-1)}
            disabled={index === 0}
            className="rounded-full text-primary-contrast hover:bg-primary-contrast/15 disabled:opacity-40"
          />
          <span className="min-w-14 text-center text-sm font-medium tabular-nums" aria-live="polite">
            {counter}
          </span>
          <IconButton
            icon={<ChevronRight aria-hidden />}
            label={t('pitch.next')}
            onClick={() => go(1)}
            disabled={index === total - 1}
            className="rounded-full text-primary-contrast hover:bg-primary-contrast/15 disabled:opacity-40"
          />
        </div>
        <p
          className={cn(
            'absolute top-4 left-4 z-10 hidden text-sm text-primary-contrast/60 transition-opacity duration-200 motion-reduce:transition-none pointer-fine:block',
            !controls && 'opacity-0',
          )}
        >
          {t('pitch.hint')}
        </p>
        {/* Телефон в портрете: слайд мелкий — подсказать повернуть */}
        <p className="absolute inset-x-4 top-[calc(50%+28vw+1.5rem)] z-10 hidden items-center justify-center gap-2 text-center text-sm text-primary-contrast/70 portrait:pointer-coarse:flex">
          <RotateCw aria-hidden className="size-4 shrink-0" />
          {t('pitch.rotate')}
        </p>
      </div>
    </Portal>
  );
}
