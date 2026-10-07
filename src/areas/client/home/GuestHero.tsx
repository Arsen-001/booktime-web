'use client';

import { BellRing, Check, CircleCheck, Repeat, Search, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarMark } from '@/areas/client/home/CalendarMark';
import { useReducedMotion } from '@/areas/client/home/landing';
import { PhoneDemo } from '@/areas/client/home/PhoneDemo';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';

const ROTATE = [1, 2, 3, 4, 5] as const;
const HINTS = [1, 2, 3, 4] as const;
const ROTATE_MS = 2200;
const SLIDE_MS = 6000;

/**
 * Первый экран главной для гостя — вариант «Живая запись» (владелец 03.10.2026): в заголовке меняется услуга
 * («на маникюр / на стрижку / к стоматологу…»), в поиске сама печатается подсказка, справа телефон показывает запись.
 * На телефоне — слайдер из трёх картинок с подписями и поиск под ним (владелец 08.10.2026: столбик текста был непонятен).
 */
export function GuestHero() {
  return (
    <section data-f="F-00-005">
      <div className="flex flex-col gap-5 md:hidden">
        <HeroSlider />
        <HeroSearch />
      </div>
      <div className="hidden md:block">
        <DesktopHero />
      </div>
    </section>
  );
}

function DesktopHero() {
  const t = useT('client');
  const points = [t('home.hero.free'), t('home.hero.noCalls'), t('home.hero.reminders')];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <span className="inline-flex w-max max-w-full items-center gap-2.5 rounded-full border border-border bg-surface py-1.5 pr-3.5 pl-2.5 text-sm font-semibold text-muted">
          <span className="lp-pulse" />
          {t('home.hero.eyebrow')}
        </span>
        {/* Каждая часть — своей строкой: меняющееся слово не перескакивает со строки на строку и не двигает текст ниже
            (на армянском слова длинные — владелец 03.10.2026: «текст меняет место») */}
        <h1 className="lp-title font-display text-[clamp(1.85rem,8vw,2.5rem)] leading-[1.08] font-extrabold text-fg sm:text-[3.25rem] lg:text-[3.25rem] xl:text-[3.5rem]">
          <span className="block">{t('home.hero.titleStart')}</span>
          <span className="block">
            <RotatingWord />
          </span>
          <span className="block">{t('home.hero.titleEnd')}</span>
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
    </div>
  );
}

/**
 * Слайдер первого экрана на телефоне: листается пальцем (scroll-snap), точки под ним, сам перелистывает каждые 6 с,
 * пока гость не тронул его; при «меньше движения» — только вручную.
 */
function HeroSlider() {
  const t = useT('client');
  const reduced = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);

  const slides: { visual: ReactNode; title: ReactNode; text: string }[] = [
    {
      visual: (
        // zoom, а не scale: телефон нарисован под ширину 270 px, уменьшаем его целиком вместе с местом, которое он занимает
        <div className="w-[270px]" style={{ zoom: 0.54 }}>
          <PhoneDemo />
        </div>
      ),
      title: (
        <>
          {t('home.hero.titleStart')} <RotatingWord /> {t('home.hero.titleEnd')}
        </>
      ),
      text: t('home.hero.text'),
    },
    {
      visual: (
        <div className="w-[14rem]">
          <CalendarMark />
        </div>
      ),
      title: t('home.slides.calendarTitle'), text: t('home.slides.calendarText') },
    { visual: <ReminderVisual />, title: t('home.slides.remindTitle'), text: t('home.slides.remindText') },
  ];

  const goTo = (i: number) => {
    const track = trackRef.current;
    if (track) track.scrollTo({ left: i * track.clientWidth, behavior: reduced ? 'auto' : 'smooth' });
  };

  useEffect(() => {
    if (reduced || touched) return;
    const id = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const next = (Math.round(track.scrollLeft / track.clientWidth) + 1) % slides.length;
      track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [reduced, touched, slides.length]);

  return (
    <div role="region" aria-roledescription="carousel" aria-label={t('home.slides.region')} className="flex flex-col gap-2">
      <div
        ref={trackRef}
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onPointerDown={() => setTouched(true)}
        onTouchStart={() => setTouched(true)}
      >
        {slides.map((s, i) => (
          <div key={i} role="group" aria-roledescription="slide" aria-label={t('home.slides.goTo', { n: i + 1 })} className="flex w-full shrink-0 snap-center flex-col gap-4 px-4">
            <div aria-hidden className="grid h-[19.5rem] place-items-center overflow-hidden rounded-3xl bg-primary-soft">
              {s.visual}
            </div>
            {i === 0 ? (
              <h1 className="font-display text-[1.75rem] leading-tight font-extrabold text-fg">{s.title}</h1>
            ) : (
              <h2 className="font-display text-[1.75rem] leading-tight font-extrabold text-fg">{s.title}</h2>
            )}
            <p className="text-base text-muted">{s.text}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-center">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={t('home.slides.goTo', { n: i + 1 })}
            aria-current={i === active ? 'true' : undefined}
            className="grid size-10 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-focus"
            onClick={() => {
              setTouched(true);
              goTo(i);
            }}
          >
            <span className={cn('h-2 rounded-full transition-all', i === active ? 'w-6 bg-primary' : 'w-2 bg-border-strong')} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Картинка третьего слайда: напоминание из Telegram, «Вы записаны» и что можно сделать дальше */
function ReminderVisual() {
  const t = useT('client');
  const time = '17:30';
  return (
    <div className="flex w-[17.5rem] flex-col gap-2.5">
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3 shadow-lg">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-info text-primary-contrast">
          <Send className="size-4" />
        </span>
        <div className="min-w-0">
          <b className="block text-sm text-fg">{t('home.demo.pushTitle')}</b>
          <span className="block text-sm leading-snug text-muted">{t('home.demo.pushText', { time })}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-md">
        <CircleCheck className="size-8 shrink-0 text-success" />
        <div className="min-w-0">
          <b className="block font-display text-base font-extrabold text-fg">{t('home.demo.doneTitle')}</b>
          <span className="block truncate text-sm text-muted">{t('home.demo.doneText', { time })}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-fg">
          <BellRing className="size-4 text-primary-text" />
          {t('home.hero.chipReminder')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-fg">
          <Repeat className="size-4 text-primary-text" />
          {t('home.hero.chipReschedule')}
        </span>
      </div>
    </div>
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
      <span ref={listRef} aria-hidden className="lp-rot-list" style={{ transform: `translateY(${-i * 1.3}em)` }}>
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
