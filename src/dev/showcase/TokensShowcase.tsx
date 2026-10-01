'use client';

import { useFormat } from '@/i18n/useFormat';
import { cn } from '@/lib/cn';

/** Витрина токенов: цвета, типографика (три письменности), радиусы, тени, форматы. Dev-страница. */
const SWATCHES: { cls: string; name: string; fg?: string }[] = [
  { cls: 'bg-bg', name: 'bg' },
  { cls: 'bg-surface', name: 'surface' },
  { cls: 'bg-surface-2', name: 'surface-2' },
  { cls: 'bg-surface-3', name: 'surface-3' },
  { cls: 'bg-border', name: 'border' },
  { cls: 'bg-border-strong', name: 'border-strong', fg: 'text-surface' },
  { cls: 'bg-fg', name: 'text (fg)', fg: 'text-surface' },
  { cls: 'bg-muted', name: 'text-muted', fg: 'text-surface' },
  { cls: 'bg-primary', name: 'primary', fg: 'text-primary-contrast' },
  { cls: 'bg-primary-hover', name: 'primary-hover', fg: 'text-primary-contrast' },
  { cls: 'bg-primary-soft', name: 'primary-soft', fg: 'text-primary-text' },
  { cls: 'bg-accent', name: 'accent', fg: 'text-accent-contrast' },
  { cls: 'bg-accent-soft', name: 'accent-soft', fg: 'text-accent-text' },
  { cls: 'bg-success', name: 'success', fg: 'text-primary-contrast' },
  { cls: 'bg-success-soft', name: 'success-soft', fg: 'text-success' },
  { cls: 'bg-warning', name: 'warning', fg: 'text-primary-contrast' },
  { cls: 'bg-warning-soft', name: 'warning-soft', fg: 'text-warning' },
  { cls: 'bg-danger', name: 'danger', fg: 'text-primary-contrast' },
  { cls: 'bg-danger-soft', name: 'danger-soft', fg: 'text-danger' },
  { cls: 'bg-info', name: 'info', fg: 'text-primary-contrast' },
  { cls: 'bg-info-soft', name: 'info-soft', fg: 'text-info' },
  { cls: 'bg-chart-1', name: 'chart-1', fg: 'text-primary-contrast' },
  { cls: 'bg-chart-2', name: 'chart-2', fg: 'text-primary-contrast' },
  { cls: 'bg-chart-3', name: 'chart-3', fg: 'text-accent-contrast' },
  { cls: 'bg-chart-4', name: 'chart-4', fg: 'text-primary-contrast' },
  { cls: 'bg-chart-5', name: 'chart-5', fg: 'text-primary-contrast' },
  { cls: 'bg-chart-6', name: 'chart-6', fg: 'text-primary-contrast' },
  { cls: 'bg-chart-7', name: 'chart-7', fg: 'text-primary-contrast' },
  { cls: 'bg-chart-8', name: 'chart-8', fg: 'text-accent-contrast' },
];

const TYPE_SCALE = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];
const RADII = ['rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full'];
const SHADOWS = ['shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight text-fg">{title}</h2>
      {children}
    </section>
  );
}

export function TokensShowcase() {
  const fmt = useFormat();
  return (
    <div className="flex flex-col gap-10">
      <Section title="Цвета (токены src/styles/tokens.css)">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {SWATCHES.map((s) => (
            <div key={s.name} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className={cn('flex h-16 items-end p-2 text-xs font-medium', s.cls, s.fg ?? 'text-fg')}>Aa Աա</div>
              <p className="px-2 py-1.5 text-xs text-muted">{s.name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Шрифт: Noto Sans + Noto Sans Armenian">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <p data-font-sample="hy" className="text-3xl font-semibold text-fg">
            Ժամ, Երևան — Ազատ է այսօր 15:30-ին
          </p>
          <p className="text-3xl font-semibold text-fg">Запись к мастеру · Book a master</p>
          {TYPE_SCALE.map((cls) => (
            <p key={cls} className={cn(cls, 'text-fg')}>
              <span className="mr-3 inline-block w-20 text-xs text-muted">{cls}</span>
              Маникюр · Մատնահարդարում · Manicure — 8 000 ֏
            </p>
          ))}
          <p className="text-base text-muted">Второстепенный текст (text-muted) · Երկրորդական տեքստ · Secondary text</p>
          <p className="flex flex-wrap gap-4 text-base">
            <span className="font-normal">400 Regular</span>
            <span className="font-medium">500 Medium</span>
            <span className="font-semibold">600 Semibold</span>
            <span className="font-bold">700 Bold · Հայերեն</span>
          </p>
        </div>
      </Section>

      <Section title="Форматы (useFormat)">
        <div className="grid gap-2 rounded-xl border border-border bg-surface p-5 text-base sm:grid-cols-2">
          <p>Деньги: {fmt.money(5000)} · {fmt.moneyRange(8000, 12000)} · {fmt.money(1250000)}</p>
          <p>Телефон: {fmt.phone('+37400123456')} · скрытый {fmt.maskedPhone('+37400123456')}</p>
          <p>Дата: {fmt.date('2026-09-24')} · {fmt.date('2026-09-24', 'long')} · {fmt.date('2026-09-24', 'weekday')}</p>
          <p>Время 24 ч: {fmt.time('2026-09-24T09:05')} · {fmt.time('2026-09-24T21:30')}</p>
          <p>Длительность: {fmt.duration(45)} · {fmt.duration(90)} · {fmt.durationRange(60, 120)}</p>
          <p>Неделя с понедельника: {fmt.weekdaysShort().join(' ')}</p>
        </div>
      </Section>

      <Section title="Радиусы и тени">
        <div className="flex flex-wrap gap-4">
          {RADII.map((r) => (
            <div key={r} className={cn('grid size-20 place-items-center border border-border-strong bg-surface-2 text-xs text-muted', r)}>
              {r.replace('rounded-', '')}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-6 rounded-xl bg-bg p-4">
          {SHADOWS.map((s) => (
            <div key={s} className={cn('grid size-24 place-items-center rounded-xl bg-surface text-xs text-muted', s)}>
              {s}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
