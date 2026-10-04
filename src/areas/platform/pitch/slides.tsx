'use client';

/**
 * Слайды «Презентации для салонов» (/platform/pitch). Перенесены из макета (10 слайдов 1920×1080) один в один:
 * тот же порядок, тексты, сетка и цвета.
 *
 * Масштаб: кадр — контейнер (@container) с соотношением 16:9, а внутри слайда шаг сетки Tailwind переопределён
 * `--spacing: 100cqw / 480` — 1 единица = 4 px макета при ширине 1920. Поэтому p-32 = 128 px макета, gap-12 = 48 px,
 * а размеры шрифтов (FS ниже) — тоже в единицах сетки. Слайд одинаково выглядит в превью и на весь экран.
 *
 * Цвета: это слайды для показа, у них свои цвета макета, одинаковые в светлой и тёмной теме панели. Палитра — данные
 * макета (PALETTE, `tokens-ok`), а классы ссылаются на неё как bg-(--pt-dark).
 */
import type { CSSProperties, ReactNode } from 'react';
import {
  BadgeCheck,
  BookOpen,
  ChartColumn,
  CircleCheck,
  Clock,
  Globe,
  KeyRound,
  Lock,
  MessageCircle,
  Search,
  Send,
  ThumbsUp,
  TriangleAlert,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { PitchDeckTexts } from '@/areas/platform/pitch/decks.server';
import { cn } from '@/lib/cn';
import { BrandMark } from '@/shell/BrandMark';

export const SLIDE_IDS = ['cover', 'pain', 'what', 'clients', 'armenia', 'orders', 'compare', 'price', 'switch', 'cta'] as const;
export type SlideId = (typeof SLIDE_IDS)[number];

/** Палитра макета презентации (не тема панели) */
export const SLIDE_PALETTE = {
  '--pt-dark': '#17134a', // tokens-ok: цвет макета слайда
  '--pt-light': '#f7f7fb', // tokens-ok
  '--pt-white': '#fdfdff', // tokens-ok
  '--pt-indigo': '#3b32c9', // tokens-ok
  '--pt-pink': '#c4245a', // tokens-ok
  '--pt-rose': '#ff9cbf', // tokens-ok
  '--pt-body': '#4a4966', // tokens-ok
  '--pt-soft': '#cfccf5', // tokens-ok
  '--pt-line': '#e3e2ee', // tokens-ok
  '--pt-row': '#efeef8', // tokens-ok
  '--pt-muted': '#7a7896', // tokens-ok
  '--pt-muted-dark': '#9f9bd6', // tokens-ok
  '--pt-card-dark': '#221d63', // tokens-ok
  '--pt-line-dark': '#332d80', // tokens-ok
} as CSSProperties;

/** Знак BookTime на тёмной обложке — светлые клетки, как в макете */
const COVER_MARK = {
  '--brand-b': '#8b85f6', // tokens-ok: знак на обложке макета
  '--brand-t': '#ff7ca1', // tokens-ok
  '--brand-empty': '#2c2870', // tokens-ok
} as CSSProperties;

/** Размеры шрифтов макета в единицах сетки слайда (px макета / 4) */
const FS = {
  footer: 'text-[length:calc(var(--spacing)*6)]',
  small: 'text-[length:calc(var(--spacing)*6.5)]',
  body: 'text-[length:calc(var(--spacing)*7)]',
  note: 'text-[length:calc(var(--spacing)*7.5)]',
  gridTitle: 'text-[length:calc(var(--spacing)*8.5)]',
  cardTitle: 'text-[length:calc(var(--spacing)*9)]',
  lead: 'text-[length:calc(var(--spacing)*10)]',
  pill: 'text-[length:calc(var(--spacing)*12)]',
  h2: 'text-[length:calc(var(--spacing)*18)]',
  amount: 'text-[length:calc(var(--spacing)*24)]',
  ctaTitle: 'text-[length:calc(var(--spacing)*26)]',
  coverTitle: 'text-[length:calc(var(--spacing)*28)]',
} as const;

const RADIUS = 'rounded-[calc(var(--spacing)*6)]';

type Tone = 'light' | 'dark';

/** Кадр 16:9, который тянется по ширине контейнера; слайд внутри масштабируется вместе с ним */
export function SlideFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('@container relative aspect-video w-full overflow-hidden', className)} style={SLIDE_PALETTE}>
      <div className="absolute inset-0 font-sans leading-normal [--spacing:calc(100cqw/480)]">{children}</div>
    </div>
  );
}

function Eyebrow({ children, color = 'text-(--pt-indigo)' }: { children: ReactNode; color?: string }) {
  return (
    <p className={cn(FS.body, 'leading-[1.3] font-semibold tracking-[calc(var(--spacing)*0.5)] uppercase', color)}>
      {children}
    </p>
  );
}

function Title({ children, tone = 'light' }: { children: ReactNode; tone?: Tone }) {
  return (
    <h2
      className={cn(
        FS.h2,
        'font-display leading-[1.1] font-extrabold',
        tone === 'dark' ? 'text-(--pt-white)' : 'text-(--pt-dark)',
      )}
    >
      {children}
    </h2>
  );
}

function Section({
  tone = 'light',
  footer,
  n,
  className,
  children,
}: {
  tone?: Tone;
  footer: string;
  n: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col gap-12 px-32 pt-32 pb-40',
        tone === 'dark' ? 'bg-(--pt-dark) text-(--pt-white)' : 'bg-(--pt-light) text-(--pt-dark)',
        className,
      )}
    >
      {children}
      <p
        className={cn(
          FS.footer,
          'absolute bottom-16 left-32',
          tone === 'dark' ? 'text-(--pt-muted-dark)' : 'text-(--pt-muted)',
        )}
      >
        {footer} · {n}
      </p>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  body,
  tone = 'light',
  iconColor,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  tone?: Tone;
  iconColor?: string;
}) {
  const dark = tone === 'dark';
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col gap-4 border p-10',
        RADIUS,
        dark ? 'border-(--pt-line-dark) bg-(--pt-card-dark)' : 'border-(--pt-line) bg-(--pt-white)',
      )}
    >
      <Icon aria-hidden className={cn('size-12 shrink-0', iconColor ?? (dark ? 'text-(--pt-rose)' : 'text-(--pt-indigo)'))} />
      <h3 className={cn(FS.cardTitle, 'font-display leading-[1.2] font-bold', dark ? 'text-(--pt-white)' : 'text-(--pt-dark)')}>
        {title}
      </h3>
      <p className={cn(FS.body, 'leading-[1.45]', dark ? 'text-(--pt-soft)' : 'text-(--pt-body)')}>{body}</p>
    </div>
  );
}

function CardRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-row gap-8">{children}</div>;
}

const PAIN_ICONS: LucideIcon[] = [MessageCircle, TriangleAlert, Clock];
const WHAT_ICONS: LucideIcon[] = [Globe, Clock, Send, BookOpen, Users, ChartColumn];
const CLIENT_ICONS: LucideIcon[] = [Search, KeyRound, CircleCheck];
const ARMENIA_ICONS: LucideIcon[] = [Lock, Globe, ThumbsUp];
const ORDER_ICONS: LucideIcon[] = [Wrench, Send, BadgeCheck];

export interface SlideProps {
  id: SlideId;
  d: PitchDeckTexts;
  /** Номер слайда с 1 (подвал «BookTime · booktime.am · n») */
  n: number;
  /** Контакт показывающего на последнем слайде (телефон или Telegram); пусто — не показываем */
  contact?: string;
}

/** Один слайд макета; кладётся внутрь SlideFrame */
export function Slide({ id, d, n, contact }: SlideProps) {
  switch (id) {
    case 'cover':
      return (
        <div className="absolute inset-0 flex flex-row items-center justify-between gap-24 bg-(--pt-dark) p-32 text-(--pt-white)">
          <div className="flex w-275 flex-col gap-10">
            <Eyebrow color="text-(--pt-rose)">{d.cover.eyebrow}</Eyebrow>
            <h2 className={cn(FS.coverTitle, 'font-display leading-[1.05] font-extrabold text-(--pt-white)')}>{d.cover.title}</h2>
            <p className={cn(FS.cardTitle, 'leading-[1.4] text-(--pt-soft)')}>{d.cover.lead}</p>
            <p className={cn(FS.lead, 'font-display font-bold text-(--pt-white)')}>{d.cover.brand}</p>
          </div>
          <div className="w-75 shrink-0" style={COVER_MARK}>
            <BrandMark className="block h-auto w-full" />
          </div>
        </div>
      );
    case 'pain':
      return (
        <Section footer={d.footer} n={n}>
          <Eyebrow>{d.pain.eyebrow}</Eyebrow>
          <Title>{d.pain.title}</Title>
          <CardRow>
            {d.pain.cards.map((c, i) => (
              <InfoCard
                key={c.title}
                icon={PAIN_ICONS[i] ?? Clock}
                title={c.title}
                body={c.body}
                iconColor={i === 1 ? 'text-(--pt-pink)' : undefined}
              />
            ))}
          </CardRow>
        </Section>
      );
    case 'what':
      return (
        <Section footer={d.footer} n={n} className="gap-8">
          <Eyebrow>{d.what.eyebrow}</Eyebrow>
          <Title>{d.what.title}</Title>
          <div className="grid grid-cols-3 gap-6">
            {d.what.cards.map((c, i) => {
              const Icon = WHAT_ICONS[i] ?? Globe;
              return (
                <div key={c.title} className={cn('flex min-w-0 flex-col gap-3 border border-(--pt-line) bg-(--pt-white) px-9 py-8', RADIUS)}>
                  <Icon aria-hidden className="size-11 shrink-0 text-(--pt-indigo)" />
                  <h3 className={cn(FS.gridTitle, 'font-display leading-[1.2] font-bold text-(--pt-dark)')}>{c.title}</h3>
                  <p className={cn(FS.small, 'leading-[1.45] text-(--pt-body)')}>{c.body}</p>
                </div>
              );
            })}
          </div>
        </Section>
      );
    case 'clients':
      return (
        <Section tone="dark" footer={d.footer} n={n}>
          <Eyebrow color="text-(--pt-rose)">{d.clients.eyebrow}</Eyebrow>
          <Title tone="dark">{d.clients.title}</Title>
          <CardRow>
            {d.clients.cards.map((c, i) => (
              <InfoCard key={c.title} tone="dark" icon={CLIENT_ICONS[i] ?? Search} title={c.title} body={c.body} />
            ))}
          </CardRow>
        </Section>
      );
    case 'armenia':
      return (
        <Section footer={d.footer} n={n}>
          <Eyebrow>{d.armenia.eyebrow}</Eyebrow>
          <Title>{d.armenia.title}</Title>
          <CardRow>
            {d.armenia.cards.map((c, i) => (
              <InfoCard key={c.title} icon={ARMENIA_ICONS[i] ?? Globe} title={c.title} body={c.body} />
            ))}
          </CardRow>
        </Section>
      );
    case 'orders':
      return (
        <Section footer={d.footer} n={n}>
          <Eyebrow color="text-(--pt-pink)">{d.orders.eyebrow}</Eyebrow>
          <Title>{d.orders.title}</Title>
          <CardRow>
            {d.orders.cards.map((c, i) => (
              <InfoCard key={c.title} icon={ORDER_ICONS[i] ?? Send} title={c.title} body={c.body} />
            ))}
          </CardRow>
        </Section>
      );
    case 'compare':
      return (
        <Section footer={d.footer} n={n} className="gap-10">
          <Eyebrow>{d.compare.eyebrow}</Eyebrow>
          <Title>{d.compare.title}</Title>
          <table className={cn(FS.body, 'w-full table-fixed border-collapse leading-[1.3] text-(--pt-dark)')}>
            <thead>
              <tr className="border-b-2 border-(--pt-line)">
                <td className="w-[28%]" />
                {d.compare.columns.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn('w-[18%] px-5 py-4 text-left font-display font-bold', i === 0 && 'text-(--pt-indigo)')}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.compare.rows.map((row, r) => (
                <tr key={row[0]} className={cn(r % 2 === 1 && 'bg-(--pt-row)')}>
                  {row.map((cell, c) =>
                    c === 0 ? (
                      <th key={c} scope="row" className="px-5 py-4 text-left align-top font-semibold break-words">
                        {cell}
                      </th>
                    ) : (
                      <td
                        key={c}
                        className={cn('px-5 py-4 align-top break-words', c === 1 ? 'font-semibold text-(--pt-indigo)' : 'text-(--pt-body)')}
                      >
                        {cell}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className={cn(FS.footer, 'leading-[1.4] text-(--pt-muted)')}>{d.compare.footnote}</p>
        </Section>
      );
    case 'price':
      return (
        <Section footer={d.footer} n={n}>
          <Eyebrow>{d.price.eyebrow}</Eyebrow>
          <Title>{d.price.title}</Title>
          <CardRow>
            <div className={cn('flex flex-1 flex-col gap-4 border border-(--pt-line) bg-(--pt-white) p-12', RADIUS)}>
              <p className={cn(FS.body, 'text-(--pt-body)')}>{d.price.master.label}</p>
              <p className={cn(FS.amount, 'font-display leading-[1.1] font-extrabold whitespace-nowrap text-(--pt-dark)')}>
                {d.price.master.amount}
              </p>
              <p className={cn(FS.body, 'leading-[1.4] text-(--pt-body)')}>{d.price.master.period}</p>
            </div>
            <div className={cn('flex flex-1 flex-col gap-4 bg-(--pt-indigo) p-12', RADIUS)}>
              <p className={cn(FS.body, 'text-(--pt-soft)')}>{d.price.salon.label}</p>
              <p className={cn(FS.amount, 'font-display leading-[1.1] font-extrabold whitespace-nowrap text-(--pt-white)')}>
                {d.price.salon.amount}
              </p>
              <p className={cn(FS.body, 'leading-[1.4] text-(--pt-soft)')}>{d.price.salon.period}</p>
            </div>
          </CardRow>
          <p className={cn(FS.note, 'leading-[1.45] text-(--pt-body)')}>
            {d.price.note} <b className="font-semibold text-(--pt-dark)">{d.price.noteStrong}</b>
          </p>
        </Section>
      );
    case 'switch':
      return (
        <Section footer={d.footer} n={n}>
          <Eyebrow>{d.switch.eyebrow}</Eyebrow>
          <Title>{d.switch.title}</Title>
          <ol className="flex flex-row gap-16">
            {d.switch.steps.map((s, i) => (
              <li key={s.title} className="flex min-w-0 flex-1 flex-col gap-4">
                <p className={cn(FS.h2, 'font-display leading-none font-extrabold text-(--pt-indigo)')}>{i + 1}</p>
                <h3 className={cn(FS.lead, 'font-display leading-[1.2] font-bold text-(--pt-dark)')}>{s.title}</h3>
                <p className={cn(FS.note, 'leading-[1.45] text-(--pt-body)')}>{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>
      );
    case 'cta':
      return (
        <div className="absolute inset-0 flex flex-col justify-center gap-12 bg-(--pt-indigo) p-32 text-(--pt-white)">
          <h2 className={cn(FS.ctaTitle, 'font-display leading-[1.05] font-extrabold text-(--pt-white)')}>{d.cta.title}</h2>
          <p className={cn(FS.lead, 'leading-[1.4] text-(--pt-soft)')}>{d.cta.lead}</p>
          <div className="flex min-w-0 flex-row items-center gap-12">
            <p
              className={cn(
                FS.pill,
                'shrink-0 rounded-[calc(var(--spacing)*5)] bg-(--pt-white) px-12 py-6 font-display leading-[1.2] font-bold text-(--pt-indigo)',
              )}
            >
              {d.cta.link}
            </p>
            {contact && (
              <p className={cn(FS.pill, 'min-w-0 truncate py-6 font-display leading-[1.2] font-bold text-(--pt-white)')}>{contact}</p>
            )}
          </div>
        </div>
      );
  }
}

/** Заметки для выступающего (в макете — <aside>); у части слайдов их нет */
export function slideNotes(d: PitchDeckTexts, id: SlideId): string | undefined {
  const s: unknown = d[id];
  if (s && typeof s === 'object' && 'notes' in s && typeof s.notes === 'string') return s.notes;
  return undefined;
}
