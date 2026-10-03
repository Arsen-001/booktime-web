'use client';

import { Send } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/areas/client/home/landing';
import { useT } from '@/i18n/useT';
import { BrandMark } from '@/shell/BrandMark';
import { useIsClient } from '@/ui/hooks/useIsClient';

const TODAY = ['15:00', '16:00', '17:30', '18:15', '19:00', '19:45'] as const;
const TOMORROW = ['10:00', '11:30', '12:00'] as const;
const PICK = '17:30';
const LOOP_MS = 8800;

/**
 * Телефон на первом экране сам показывает запись (владелец 03.10.2026, вариант «Живая запись»): палец жмёт 17:30 →
 * выезжает «Записаться» → галочка «Вы записаны» → сверху приходит напоминание из Telegram. Картинка, не управление
 * (aria-hidden); при «меньше движения» — сразу последний кадр.
 */
export function PhoneDemo() {
  const t = useT('client');
  const reduced = useReducedMotion();
  // «Сегодня, <день недели>» — по дате в браузере и только после монтирования (у сервера свой пояс — гидрация
  // разошлась бы); до этого просто «Сегодня». Названия — из словаря, как в CalendarMark (Intl может не знать армянский)
  const client = useIsClient();
  const todayLabel = client
    ? t('home.demo.todayWeekday', { weekday: t('home.demo.weekdaysFull').split(',')[new Date().getDay()] })
    : t('home.demo.today');
  const appRef = useRef<HTMLDivElement>(null);
  const fingerRef = useRef<HTMLSpanElement>(null);
  const pickRef = useRef<HTMLSpanElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<HTMLSpanElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const pushRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const app = appRef.current;
    const finger = fingerRef.current;
    const pick = pickRef.current;
    const sheet = sheetRef.current;
    const go = goRef.current;
    const done = doneRef.current;
    const push = pushRef.current;
    if (!app || !finger || !pick || !sheet || !go || !done || !push) return;
    const on = (el: Element, v: boolean, attr = 'data-on') => (v ? el.setAttribute(attr, '') : el.removeAttribute(attr));

    if (reduced) {
      on(pick, true, 'data-picked');
      on(push, true);
      return;
    }

    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    const moveTo = (el: Element) => {
      const a = app.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      finger.style.transform = `translate(${r.left - a.left + r.width / 2}px, ${r.top - a.top + r.height / 2}px)`;
    };
    const tap = (el: Element) => {
      finger.removeAttribute('data-tap');
      void finger.offsetWidth;
      finger.setAttribute('data-tap', '');
      const ripple = document.createElement('i');
      ripple.className = 'lp-ripple';
      el.appendChild(ripple);
      at(700, () => ripple.remove());
    };
    const play = () => {
      on(pick, false, 'data-picked');
      on(sheet, false);
      on(done, false);
      on(push, false);
      on(finger, false);
      finger.style.transform = `translate(${app.clientWidth * 0.8}px, ${app.clientHeight * 0.9}px)`;
      at(500, () => {
        on(finger, true);
        moveTo(pick);
      });
      at(1400, () => {
        tap(pick);
        on(pick, true, 'data-picked');
      });
      at(1900, () => on(sheet, true));
      at(2600, () => moveTo(go));
      at(3400, () => {
        tap(go);
        on(go, true, 'data-tap');
        at(160, () => on(go, false, 'data-tap'));
      });
      at(3700, () => {
        on(finger, false);
        on(sheet, false);
        on(done, true);
      });
      at(5200, () => on(push, true));
      at(LOOP_MS, play);
    };
    play();
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [reduced]);

  return (
    <div aria-hidden className="lp-phone">
      <div className="lp-screen">
        <div ref={appRef} className="lp-app">
          <div className="flex items-center justify-between gap-2 pt-1 text-sm font-bold text-fg">
            <span className="truncate">{t('home.demo.header')}</span>
            <BrandMark className="h-5 w-6 shrink-0" />
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-2.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent-text">
              {t('home.demo.initials')}
            </span>
            <div className="min-w-0">
              <b className="block truncate text-sm text-fg">{t('home.demo.master')}</b>
              <span className="block truncate text-xs text-muted">{t('home.demo.service')}</span>
            </div>
          </div>
          <p className="mt-1 text-xs font-semibold text-muted">{todayLabel}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {TODAY.map((s) => (
              <span key={s} ref={s === PICK ? pickRef : undefined} className="lp-slot">
                {s}
              </span>
            ))}
          </div>
          <p className="mt-1 text-xs font-semibold text-muted">{t('home.demo.tomorrow')}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {TOMORROW.map((s) => (
              <span key={s} className="lp-slot">
                {s}
              </span>
            ))}
          </div>

          <div ref={sheetRef} className="lp-sheet">
            <b className="text-[15px] text-fg">{t('home.demo.sheetTitle', { time: PICK })}</b>
            <span className="text-xs text-muted">{t('home.demo.sheetText')}</span>
            <span ref={goRef} className="lp-go">
              {t('home.demo.book')}
            </span>
          </div>

          <div ref={doneRef} className="lp-done">
            <svg viewBox="0 0 84 84" className="size-20">
              <circle cx="42" cy="42" r="38" />
              <path d="M27 43l10 10 20-21" />
            </svg>
            <b className="font-display text-xl font-extrabold text-fg">{t('home.demo.doneTitle')}</b>
            <span className="text-xs text-muted">{t('home.demo.doneText', { time: PICK })}</span>
          </div>

          <div ref={pushRef} className="lp-push">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-info text-primary-contrast">
              <Send className="size-4" />
            </span>
            <div className="min-w-0">
              <b className="block text-xs text-fg">{t('home.demo.pushTitle')}</b>
              <span className="block text-xs leading-snug text-muted">{t('home.demo.pushText', { time: PICK })}</span>
            </div>
          </div>

          <span ref={fingerRef} className="lp-finger" />
        </div>
      </div>
    </div>
  );
}
