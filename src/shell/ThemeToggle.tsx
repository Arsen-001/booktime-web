'use client';

import { Moon, Sun } from 'lucide-react';
import type { MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { useApplyDemo, useDemo } from '@/demo/hooks';
import { useT } from '@/i18n/useT';
import { IconButton } from '@/ui/IconButton';

const REVEAL_MS = 500;

/**
 * Светлая / тёмная тема в верхней полосе (владелец 03.10.2026: «рядом с кнопкой входа»); запоминается в cookie theme.
 * Смена — как в Telegram (владелец 08.10.2026): новая тема расходится кругом от кнопки на весь экран (View Transitions,
 * класс vt-theme в globals.css). Без поддержки браузера или при «меньше движения» — сразу.
 */
export function ThemeToggle() {
  const t = useT('common');
  const { theme } = useDemo();
  const apply = useApplyDemo();
  const dark = theme === 'dark';

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    const next = dark ? 'light' : 'dark';
    const doc = document as Document & { startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> } };
    if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      apply({ theme: next });
      return;
    }
    const box = e.currentTarget.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const root = document.documentElement;
    root.classList.add('vt-theme');
    const transition = doc.startViewTransition(() => flushSync(() => apply({ theme: next })));
    transition.ready
      .then(() =>
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: REVEAL_MS, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
        ),
      )
      .catch(() => {});
    transition.finished.finally(() => root.classList.remove('vt-theme'));
  };

  return (
    <IconButton
      icon={dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
      label={dark ? t('shell.themeLight') : t('shell.themeDark')}
      onClick={toggle}
    />
  );
}
