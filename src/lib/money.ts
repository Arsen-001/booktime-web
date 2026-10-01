import type { Money } from '@/domain/core';

/** Знак драма */
export const AMD = '֏';
const NBSP = ' ';

/** 5000 → «5 000» (неразрывные пробелы) */
export function formatNumber(value: number): string {
  const sign = value < 0 ? '−' : '';
  const digits = String(Math.round(Math.abs(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 5000 → «5 000 ֏» */
export function formatMoney(value: Money): string {
  return `${formatNumber(value)}${NBSP}${AMD}`;
}

/** Цена «от–до»: 5000, 8000 → «5 000–8 000 ֏»; без max — «5 000 ֏» */
export function formatMoneyRange(min: Money, max?: Money): string {
  if (max === undefined || max <= min) return formatMoney(min);
  // U+2060 (word joiner) — диапазон не рвётся на строки у тире
  return `${formatNumber(min)}\u2060–\u2060${formatNumber(max)}${NBSP}${AMD}`;
}

/** «5 000 ֏» / «5000» → 5000 */
export function parseMoney(text: string): Money | undefined {
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : undefined;
}
