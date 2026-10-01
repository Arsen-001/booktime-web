'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, ViewTransition, type ReactNode } from 'react';

/** Сколько самое большее держим старую страницу, пока новая получает данные (дольше — пусть покажет скелет) */
const HOLD_MAX_MS = 300;

/**
 * Переход между страницами кабинета и панели — нативный View Transitions API через React <ViewTransition>
 * (Next 16: навигация — это transition, анимация включается сама; JS в кадрах не участвует).
 * key={pathname}: страница уходит/приходит только при смене адреса — смена ?tab=, фильтров и прочие transition
 * внутри страницы ничего не анимируют (default="none").
 * Направление: ссылки «Назад» (PageHeader.back, хлебные крошки) несут тип nav-back, карточки-ссылки — nav-forward —
 * новая страница приезжает сбоку; всё остальное (меню, кнопка «назад» браузера) — мгновенная смена без анимации:
 * любое проявление/угасание давало провал в пустой фон — «мигание» (owner 30.09.2026). CSS — globals.css → «Переходы страниц».
 *
 * Без вспышки скелета: новая страница встала, а её данные ещё в пути (обычно 50–150 мс) — старая страница
 * остаётся на экране (снимок перехода, класс vt-hold), пока скелеты не заполнятся, но не дольше HOLD_MAX_MS.
 * Тогда смена одна: старая страница → новая уже с данными. Данные дольше — после HOLD_MAX_MS виден точный скелет.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const first = useRef(true);

  // Слой-эффект новой страницы выполняется внутри перехода, до снимка нового состояния — класс успевает к снимку
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const html = document.documentElement;
    const content = document.getElementById('content') ?? document.body;
    const loading = () => content.querySelector('[data-skeleton]') !== null;
    if (!loading()) return;
    html.classList.add('vt-hold');
    const vtAnimations = () => document.getAnimations().filter((a) => (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith('::view-transition'));
    const release = () => {
      html.classList.remove('vt-hold');
      // Переход заканчивается сразу — на экране живая страница (с данными)
      for (const a of vtAnimations()) a.finish();
    };
    const started = performance.now();
    let frame = requestAnimationFrame(function check() {
      // React, когда корень не анимируется, прячет снимок корня своей анимацией (под ним видна живая страница —
      // её скелет). Пока держим — снимаем её: виден снимок старой страницы (globals.css → vt-hold)
      for (const a of vtAnimations()) {
        if (!(a instanceof CSSAnimation) && (a.effect as KeyframeEffect).pseudoElement === '::view-transition-group(root)') a.cancel();
      }
      if (!loading() || performance.now() - started > HOLD_MAX_MS) release();
      else frame = requestAnimationFrame(check);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (html.classList.contains('vt-hold')) release();
    };
  }, [pathname]);

  return (
    <ViewTransition
      key={pathname}
      enter={{ 'nav-forward': 'page-forward', 'nav-back': 'page-back', default: 'none' }}
      exit={{ 'nav-forward': 'page-forward', 'nav-back': 'page-back', default: 'none' }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
