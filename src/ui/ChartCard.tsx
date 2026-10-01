'use client';

import { Children, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { ChartNoAxesColumn } from 'lucide-react';
import { ResponsiveContainer } from 'recharts';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/ui/Skeleton';
import { useIsClient } from '@/ui/hooks/useIsClient';

/** Цвета серий — токены chart-1…8 (меняются с темой) */
export const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const;

/**
 * Готовые свойства элементов recharts в цветах темы:
 *   <CartesianGrid {...chartTheme.grid} />  <XAxis dataKey="day" {...chartTheme.axis} />
 *   <Tooltip {...chartTheme.tooltip} />  <Legend {...chartTheme.legend} />
 */
export const chartTheme = {
  grid: { stroke: 'var(--border)', strokeDasharray: '3 3', vertical: false },
  axis: {
    stroke: 'var(--border)',
    tick: { fill: 'var(--text-muted)', fontSize: 12 },
    tickLine: false,
    axisLine: false,
  },
  tooltip: {
    contentStyle: {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      color: 'var(--text)',
      boxShadow: 'var(--sh-md)',
      fontSize: 14,
    } satisfies CSSProperties,
    labelStyle: { color: 'var(--text-muted)', marginBottom: 4 } satisfies CSSProperties,
    itemStyle: { color: 'var(--text)' } satisfies CSSProperties,
    cursor: { fill: 'var(--surface-2)' },
  },
  legend: { wrapperStyle: { color: 'var(--text-muted)', fontSize: 13 } satisfies CSSProperties },
};

type Row = Record<string, unknown>;

const SERIES = /^(Bar|Line|Area|Scatter)$/;

function isZeroish(v: unknown): boolean {
  return v === null || v === undefined || v === 0 || v === '';
}

/** Все ли серии графика пусты: data = [] или у каждой серии только нули */
function chartLooksEmpty(chart: ReactElement): boolean {
  const props = chart.props as { data?: unknown; children?: ReactNode };
  const keys: string[] = [];
  const pies: unknown[] = [];
  Children.forEach(props.children, (child) => {
    if (!isValidElement(child)) return;
    const name = (child.type as { displayName?: string }).displayName ?? '';
    const p = child.props as { dataKey?: unknown; data?: unknown };
    if (SERIES.test(name) && typeof p.dataKey === 'string') keys.push(p.dataKey);
    if (name === 'Pie') pies.push(p);
  });
  if (pies.length) {
    return pies.every((pie) => {
      const { data, dataKey } = pie as { data?: unknown; dataKey?: unknown };
      if (!Array.isArray(data)) return false;
      return data.length === 0 || (typeof dataKey === 'string' && data.every((r) => isZeroish((r as Row)[dataKey])));
    });
  }
  const data = props.data;
  if (!Array.isArray(data)) return false;
  if (data.length === 0) return true;
  return keys.length > 0 && data.every((row) => keys.every((k) => isZeroish((row as Row)[k])));
}

export interface ChartCardProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  loading?: boolean;
  /** Нет данных — вместо графика пустое состояние. Не задано — ChartCard решает сам (см. autoEmpty) */
  empty?: boolean;
  /**
   * Сам понять, что показывать нечего: у графика `data` пустой массив или у всех серий (Bar/Line/Area/Scatter по
   * dataKey, Pie по своим data) только нули. По умолчанию включено — пустая сетка с подписями дней выглядит поломкой.
   */
  autoEmpty?: boolean;
  /** Своя фраза пустого состояния (по умолчанию «Нет данных за период») */
  emptyText?: ReactNode;
  /** Кнопка первого действия в пустом состоянии */
  emptyAction?: ReactNode;
  /** Высота области графика, px */
  height?: number;
  /**
   * ОДИН график recharts (BarChart, LineChart, AreaChart, PieChart…) без ResponsiveContainer —
   * ChartCard сам оборачивает его в ResponsiveContainer на всю ширину и заданную высоту.
   */
  children: ReactElement;
  footer?: ReactNode;
  className?: string;
}

/** Карточка с графиком: заголовок, действия, загрузка, «нет данных». График рисуется только в браузере. */
export function ChartCard({
  title,
  description,
  actions,
  loading = false,
  empty,
  autoEmpty = true,
  emptyText,
  emptyAction,
  height = 260,
  children,
  footer,
  className,
}: ChartCardProps) {
  const t = useT('ui');
  const isClient = useIsClient();
  const isEmpty = empty ?? (autoEmpty && isValidElement(children) && chartLooksEmpty(children));

  return (
    <section
      aria-busy={loading || undefined}
      className={cn('flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs md:p-5', className)}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base leading-snug font-semibold tracking-tight text-fg">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div style={{ height }} className="relative w-full">
        {loading ? (
          <Skeleton variant="rect" className="h-full" />
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border-strong/40 bg-surface-2/50 px-4 text-center text-sm text-muted">
            <span
              aria-hidden
              className="inline-flex size-11 items-center justify-center rounded-full bg-surface text-muted shadow-xs"
            >
              <ChartNoAxesColumn className="size-5" />
            </span>
            <span className="max-w-xs leading-relaxed">{emptyText ?? t('chart.noData')}</span>
            {emptyAction && <div className="mt-1">{emptyAction}</div>}
          </div>
        ) : isClient ? (
          <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 320, height }}>
            {children}
          </ResponsiveContainer>
        ) : null}
      </div>
      {footer}
    </section>
  );
}
