/**
 * Рабочее время дня как «с–по» + перерывы (F-02-012, F-02-013), поверх DayHours ядра
 * (несколько интервалов = перерывы между ними — F-02-017 «старый редактор» 1:1).
 */
import type { DayHours, TimeRange } from '@/domain/core';
import { toMinutes } from '@/lib/date';

/** Часы по умолчанию, когда взять неоткуда (новый мастер, пустая ячейка) — 10:00–19:00, не 10–22 (ux-r5 S-2) */
export const DEFAULT_HOURS: DayHours = [{ from: '10:00', to: '19:00' }];

/** Готовые варианты часов — чипами вместо двух пустых полей (ux-best-c1 №2) */
export const HOUR_PRESETS: DayHours[] = [
  [{ from: '09:00', to: '18:00' }],
  [{ from: '10:00', to: '19:00' }],
  [{ from: '10:00', to: '21:00' }],
  [{ from: '11:00', to: '20:00' }],
];

/** Г10: готовые смены «день / вечер» — для салонов, где мастера делят день на две половины */
export const SPLIT_PRESETS: { id: 'day' | 'evening'; hours: DayHours }[] = [
  { id: 'day', hours: [{ from: '09:00', to: '15:00' }] },
  { id: 'evening', hours: [{ from: '15:00', to: '21:00' }] },
];

/** «10:00» → «10», «10:30» → «10:30» — компактно для ячеек таблицы */
export function shortTime(time: string): string {
  return time.endsWith(':00') ? String(Number(time.slice(0, 2))) : `${Number(time.slice(0, 2))}:${time.slice(3, 5)}`;
}

/** Часы дня без перерывов одной строкой: «10–19», «10:30–19» */
export function shortHours(hours: DayHours): string {
  if (hours.length === 0) return '';
  return `${shortTime(hours[0].from)}–${shortTime(hours[hours.length - 1].to)}`;
}

/** Полная строка: «10:00–19:00» */
export function spanText(hours: DayHours): string {
  if (hours.length === 0) return '';
  return `${hours[0].from}–${hours[hours.length - 1].to}`;
}

export function sameHours(a: DayHours, b: DayHours): boolean {
  return a.length === b.length && a.every((r, i) => r.from === b[i].from && r.to === b[i].to);
}

export interface RangeAndBreaks {
  from: string;
  to: string;
  breaks: TimeRange[];
}

export function hoursToRangeAndBreaks(hours: DayHours): RangeAndBreaks {
  if (hours.length === 0) return { from: DEFAULT_HOURS[0].from, to: DEFAULT_HOURS[0].to, breaks: [] };
  const sorted = [...hours].sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
  const breaks: TimeRange[] = [];
  for (let i = 0; i < sorted.length - 1; i++) breaks.push({ from: sorted[i].to, to: sorted[i + 1].from });
  return { from: sorted[0].from, to: sorted[sorted.length - 1].to, breaks };
}

export function rangeAndBreaksToHours({ from, to, breaks }: RangeAndBreaks): DayHours {
  if (!from || !to || toMinutes(to) <= toMinutes(from)) return [];
  const points = [toMinutes(from), toMinutes(to)];
  const sortedBreaks = [...breaks]
    .filter((b) => b.from && b.to && toMinutes(b.to) > toMinutes(b.from))
    .sort((a, b) => toMinutes(a.from) - toMinutes(b.from));
  const out: DayHours = [];
  let cursor = points[0];
  for (const b of sortedBreaks) {
    const bFrom = toMinutes(b.from);
    const bTo = toMinutes(b.to);
    if (bFrom <= cursor || bFrom >= points[1]) continue;
    out.push({ from: minutesToHM(cursor), to: minutesToHM(bFrom) });
    cursor = Math.max(cursor, bTo);
  }
  if (cursor < points[1]) out.push({ from: minutesToHM(cursor), to: minutesToHM(points[1]) });
  return out;
}

function minutesToHM(total: number): TimeRange['from'] {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` as TimeRange['from'];
}

/** «пятница, 25 сентября» → «Пятница, 25 сентября» — для заголовков (first-letter в строчном тексте не срабатывает) */
export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// ─────────── Черновик часов с проверкой (Г1, Г5, Г17) ───────────
//
// Поля «с / до» и перерывы живут черновиком: неверное значение НЕ превращается молча в выходной и не
// исчезает — оно остаётся в поле, рядом пишется, что не так, а «Сохранить» ждёт исправления.

export interface HoursDraft {
  /** null — поле пустое (разные часы в выборе, Г17): человек выбирает сам */
  from: TimeRange['from'] | null;
  to: TimeRange['to'] | null;
  breaks: TimeRange[];
}

export type RangeError = 'missing' | 'endBeforeStart';
export type BreakError = 'endBeforeStart' | 'outside' | 'overlap';

export interface DraftCheck {
  ok: boolean;
  range?: RangeError;
  breaks: (BreakError | undefined)[];
}

export function hoursToDraft(hours: DayHours | null): HoursDraft {
  if (hours === null) return { from: null, to: null, breaks: [] };
  const { from, to, breaks } = hoursToRangeAndBreaks(hours);
  return { from: from as TimeRange['from'], to: to as TimeRange['to'], breaks };
}

export function checkDraft(d: HoursDraft): DraftCheck {
  const range: RangeError | undefined = !d.from || !d.to ? 'missing' : toMinutes(d.to) <= toMinutes(d.from) ? 'endBeforeStart' : undefined;
  const start = d.from ? toMinutes(d.from) : 0;
  const end = d.to ? toMinutes(d.to) : 24 * 60;
  const breaks = d.breaks.map((b, i): BreakError | undefined => {
    const bf = toMinutes(b.from);
    const bt = toMinutes(b.to);
    if (bt <= bf) return 'endBeforeStart';
    if (!range && (bf <= start || bt >= end)) return 'outside';
    const overlaps = d.breaks.some((o, j) => j !== i && toMinutes(o.from) < bt && bf < toMinutes(o.to) && toMinutes(o.to) > toMinutes(o.from));
    return overlaps ? 'overlap' : undefined;
  });
  return { ok: !range && breaks.every((b) => !b), range, breaks };
}

/** Черновик → часы; только для проверенного черновика (checkDraft(d).ok) */
export function draftToHours(d: HoursDraft): DayHours {
  if (!d.from || !d.to) return [];
  return rangeAndBreaksToHours({ from: d.from, to: d.to, breaks: d.breaks });
}

/** Г5: новый перерыв — 30 минут сразу после последнего, а если перерывов нет — в середине смены */
export function nextBreak(d: HoursDraft): TimeRange {
  const start = d.from ? toMinutes(d.from) : 10 * 60;
  const end = d.to && toMinutes(d.to) > start ? toMinutes(d.to) : start + 9 * 60;
  const last = [...d.breaks].sort((a, b) => toMinutes(a.to) - toMinutes(b.to)).at(-1);
  let from = last ? toMinutes(last.to) : Math.floor((start + (end - start) / 2) / 30) * 30;
  if (from + 30 >= end) from = Math.max(start + 30, end - 60);
  return { from: minutesToHM(from), to: minutesToHM(from + 30) };
}

/** «12:30» + 15 мин — для нижней границы поля «до» (Г1: время раньше «с» в списке недоступно) */
export function addMinutesHM(time: TimeRange['from'], minutes: number): TimeRange['from'] {
  return minutesToHM(Math.min(24 * 60, toMinutes(time) + minutes));
}

/** Перерывы дня списком «14:00–15:00» — для подсказки в клетке (Г13) */
export function breaksOf(hours: DayHours): TimeRange[] {
  return hoursToRangeAndBreaks(hours).breaks;
}
