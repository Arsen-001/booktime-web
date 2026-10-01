/**
 * Название шаблона словами на языке человека (text-q3 №8, ux-r2 m-21): «Пн–Пт, 10:00–19:00», «2 через 2, 10:00–21:00».
 * Своё название человек может не вводить — оно подставится само.
 */
import type { DayHours } from '@/domain/core';
import type { TemplateKind } from '@/domain/schedule';
import { spanText } from '@/areas/schedule/lib/hours';

export interface TemplateNameInput {
  kind: Exclude<TemplateKind, 'none'>;
  weekdays?: number[];
  shiftWork?: number;
  shiftOff?: number;
  hours: DayHours;
}

/** Дни недели подряд — диапазоном «Пн–Пт», вразнобой — списком «Пн, Ср, Пт» */
export function weekdaysLabel(days: number[], names: string[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 0) return '';
  if (sorted.length === 7) return `${cap(names[0])}–${names[6]}`;
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (consecutive && sorted.length > 2) return `${cap(names[sorted[0]])}–${names[sorted[sorted.length - 1]]}`;
  return sorted.map((d, i) => (i === 0 ? cap(names[d]) : names[d])).join(', ');
}

function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export function templateAutoName(tpl: TemplateNameInput, names: string[], shiftsLabel: (work: number, off: number) => string): string {
  const days = tpl.kind === 'weekdays' ? weekdaysLabel(tpl.weekdays ?? [], names) : shiftsLabel(tpl.shiftWork ?? 1, tpl.shiftOff ?? 0);
  const hours = spanText(tpl.hours);
  return hours ? `${days}, ${hours}` : days;
}
