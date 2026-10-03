'use client';

import { Check, Repeat, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CalendarMark } from '@/areas/client/home/CalendarMark';
import { useReducedMotion } from '@/areas/client/home/landing';
import { PhoneDemo } from '@/areas/client/home/PhoneDemo';
import { useT } from '@/i18n/useT';

const ROTATE = [1, 2, 3, 4, 5] as const;
const HINTS = [1, 2, 3, 4] as const;
const ROTATE_MS = 2200;

/**
 * Первый экран главной для гостя — вариант «Живая запись» (владелец 03.10.2026): в заголовке меняется услуга
 * («на маникюр / на стрижку / к стоматологу…»), в поиске сама печатается подсказка, справа телефон показывает запись.
 */
export function GuestHero() {
  const t = useT('client');
  const points = [t('home.hero.free'), t('home.hero.noCalls'), t('home.hero.reminders')];

  return (
    <section data-f="F-00-005" className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <span className="inline-flex w-max max-w-full items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pr-3.5 pl-2.5 text-sm font-semibold text-muted">
          <span className="lp-pulse" />
          {t('home.hero.eyebrow')}
        </span>
        <h1 className="font-display text-[clamp(1.85rem,8vw,2.5rem)] leading-[1.08] font-extrabold text-fg sm:text-[3.25rem] lg:text-[3.25rem] xl:text-[3.5rem]">
          {t('home.hero.titleStart')} <RotatingWord />
          <br />
          {t('home.hero.titleEnd')}
        </h1>
        <p className="max-w-[52ch] text-base text-muted md:text-lg">{t('home.hero.text')}</p>
        <HeroSearch />
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[15px] text-fg">
          {points.map((p) => (
            <li key={p} className="inline-flex items-center gap-1.5">
              <Check aria-hidden className="size-4 shrink-0 text-success" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      {/* Телефон и календарь рядом (владелец 03.10.2026); на узком телефоне календарь над телефоном */}
      <div className="relative flex flex-col items-center justify-center gap-5 py-2 min-[560px]:flex-row min-[560px]:gap-4 lg:gap-6">
        <CalendarMark />
        <PhoneDemo />
        <span aria-hidden data-late="" className="lp-chip absolute right-0 bottom-[12%] hidden items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-fg shadow-md xl:flex">
          <Repeat className="size-4 text-primary-text" />
          {t('home.hero.chipReschedule')}
        </span>
      </div>
    </section>
  );
}

/** «на маникюр → на стрижку → …»: ширина плавно подстраивается под слово, текст для чтения — первый вариант */
function RotatingWord() {
  const t = useT('client');
  const reduced = useReducedMotion();
  const words = ROTATE.map((n) => t(`home.hero.rotate${n}`));
  const wordsKey = words.join('|');
  const [i, setI] = useState(0);
  const boxRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const item = listRef.current?.children[i] as HTMLElement | undefined;
    if (box && item) box.style.width = `${item.getBoundingClientRect().width}px`;
  }, [i, wordsKey]);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % ROTATE.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <span ref={boxRef} className="lp-rot">
      <span className="sr-only">{words[0]}</span>
      <span ref={listRef} aria-hidden className="lp-rot-list" style={{ transform: `translateY(${-i * 1.16}em)` }}>
        {words.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </span>
    </span>
  );
}

/** Поиск — кнопка-поле, ведёт на /search с фокусом; подсказка в поле сама печатается и стирается */
function HeroSearch() {
  const t = useT('client');
  const reduced = useReducedMotion();
  const hints = HINTS.map((n) => t(`home.hero.hint${n}`));
  const [text, setText] = useState(hints[0]);

  useEffect(() => {
    if (reduced) return;
    let p = 0;
    let c = hints[0].length;
    let dir = -1;
    let id = 0;
    const tick = () => {
      const s = hints[p];
      c += dir;
      setText(s.slice(0, Math.max(0, c)));
      let wait = dir > 0 ? 70 : 30;
      if (c >= s.length) {
        dir = -1;
        wait = 1800;
      } else if (c <= 0) {
        dir = 1;
        p = (p + 1) % hints.length;
        wait = 300;
      }
      id = window.setTimeout(tick, wait);
    };
    id = window.setTimeout(tick, 2200);
    return () => window.clearTimeout(id);
    // Подсказки меняются только со сменой языка
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, hints.join('|')]);

  return (
    <Link
      href="/search?focus=1"
      aria-label={t('home.searchPlaceholder')}
      className="group flex h-14 max-w-xl items-center gap-3 rounded-2xl border border-border bg-surface py-1.5 pr-1.5 pl-4 text-muted shadow-md transition-[border-color,box-shadow] hover:border-primary-text focus-visible:outline-2 focus-visible:outline-focus"
    >
      <Search aria-hidden className="size-5 shrink-0" />
      <span aria-hidden className="min-w-0 flex-1 truncate text-base">
        {text}
        <span className="ml-px inline-block h-5 w-px translate-y-1 animate-pulse-soft bg-muted" />
      </span>
      <span className="lp-shine inline-flex h-11 shrink-0 items-center rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-contrast transition-colors group-hover:bg-primary-hover">
        {t('home.hero.find')}
      </span>
    </Link>
  );
}
