/**
 * Отч7: график за квартал/год по дням — 90–365 столбиков толщиной в пиксель, подписи оси сливаются.
 * Длиннее 92 дней точки складываются по месяцам (суммы — суммой, проценты — средним), ось подписывается
 * месяцами. Короче — как было, по дням.
 */
export type ChartGranularity = 'day' | 'month';

const DAILY_MAX_POINTS = 92;

export function chartGranularity(points: number): ChartGranularity {
  return points > DAILY_MAX_POINTS ? 'month' : 'day';
}

/** Сложить точки { date: 'YYYY-MM-DD', …числа } по месяцам; `avgKeys` — усреднить, а не суммировать */
export function bucketByMonth<T extends { date: string }>(rows: readonly T[], avgKeys: readonly (keyof T)[] = []): T[] {
  if (chartGranularity(rows.length) === 'day') return rows as T[];
  const byMonth = new Map<string, { acc: Record<string, number>; n: number }>();
  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const slot = byMonth.get(month) ?? { acc: {}, n: 0 };
    slot.n += 1;
    for (const [k, v] of Object.entries(row)) {
      if (k === 'date' || typeof v !== 'number') continue;
      slot.acc[k] = (slot.acc[k] ?? 0) + v;
    }
    byMonth.set(month, slot);
  }
  return [...byMonth.entries()].map(([month, { acc, n }]) => {
    const out: Record<string, number | string> = { date: `${month}-01` };
    for (const [k, v] of Object.entries(acc)) out[k] = avgKeys.includes(k as keyof T) ? Math.round((v / n) * 10) / 10 : v;
    return out as unknown as T;
  });
}

/** Подпись оси денег: «1,2 млн» вместо «1 200 000» (ось — на языке страницы; графики рисуются только в браузере) */
export function compactAxis(value: number): string {
  const lang = typeof document === 'undefined' ? 'ru' : document.documentElement.lang || 'ru';
  return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
