/**
 * Математика сетки журнала: время ↔ пиксели, диапазон часов дня, шаг сетки (F-01-015, F-01-023, F-01-034).
 * Чистые функции — принадлежат разделу journal.
 */
import type { DayHours, Minutes, TimeHM } from "@/domain/core";
import type { JournalZoomMin } from "@/domain/journal";
import { fromMinutes, toMinutes } from "@/lib/date";
import { renderedJournalStyle } from "@/areas/journal/lib/journalStyle";

/** Минимум и максимум длительности одной записи (F-01-034) */
export const MIN_DURATION_MIN = 5;
export const MAX_DURATION_MIN = 23 * 60 + 55;

/**
 * Пикселей на минуту в зависимости от масштаба (F-01-015) — мельче шаг, крупнее ряды — и от вида журнала
 * (lib/journalStyle): у каждого вида свой размер текста карточки, час подобран так, чтобы 30 минут вмещали
 * строку «время, имя», а час — всю карточку.
 */
export function pxPerMin(zoomMin: JournalZoomMin): number {
  const style = renderedJournalStyle();
  // «Google Calendar» (owner 08.10.2026): мелкий текст события, час 60px при шаге 15 мин (у Google 48px)
  if (style === 'google') return zoomMin === 5 ? 1.8 : zoomMin === 10 ? 1.3 : 1.0;
  // «Календарь iOS»: час 72px при шаге 15 мин — как день в Календаре iPad
  if (style === 'ios') return zoomMin === 5 ? 2.0 : zoomMin === 10 ? 1.6 : 1.2;
  // BookTime («Живой день»): в карточке время, имя, услуга и цена — час 84px при шаге 15 мин
  return zoomMin === 5 ? 2.2 : zoomMin === 10 ? 1.8 : 1.4;
}

export interface DayRange {
  startMin: Minutes;
  endMin: Minutes;
}

const DEFAULT_START = 8 * 60;
const DEFAULT_END = 22 * 60;

/**
 * Диапазон часов сетки — только рабочее время (DESIGN.md → Journal A2: «без длинных серых утр»): от самого раннего
 * начала до самого позднего конца смен этого дня, округлено до часа. Записи вне графика расширяют диапазон, чтобы
 * ни одна не пропала. Графиков нет вовсе (ресурсы) — 08:00–22:00.
 */
export function computeDayRange(
  hourSets: DayHours[],
  spans: { from: Minutes; to: Minutes }[] = [],
): DayRange {
  let start = Infinity;
  let end = -Infinity;
  for (const hours of hourSets) {
    for (const r of hours) {
      start = Math.min(start, toMinutes(r.from));
      end = Math.max(end, toMinutes(r.to));
    }
  }
  if (!Number.isFinite(start)) {
    start = DEFAULT_START;
    end = DEFAULT_END;
  }
  for (const s of spans) {
    start = Math.min(start, s.from);
    end = Math.max(end, s.to);
  }
  start = Math.floor(start / 60) * 60;
  end = Math.min(24 * 60, Math.ceil(end / 60) * 60);
  return { startMin: start, endMin: end };
}

export function hourTicks(range: DayRange): Minutes[] {
  const ticks: Minutes[] = [];
  for (let m = range.startMin; m <= range.endMin; m += 60) ticks.push(m);
  return ticks;
}

/** Минуты дня → отступ сверху в px */
export function minutesToTop(
  minutes: Minutes,
  range: DayRange,
  zoomMin: JournalZoomMin,
): number {
  return (minutes - range.startMin) * pxPerMin(zoomMin);
}

export function rangeHeightPx(
  range: DayRange,
  zoomMin: JournalZoomMin,
): number {
  return (range.endMin - range.startMin) * pxPerMin(zoomMin);
}

/** y в px внутри колонки → время, округлённое к шагу сетки (F-01-015: клик ставит время с шагом сетки) */
export function yToTime(
  y: number,
  range: DayRange,
  zoomMin: JournalZoomMin,
): TimeHM {
  const minutes = range.startMin + y / pxPerMin(zoomMin);
  const stepped = Math.round(minutes / zoomMin) * zoomMin;
  const clamped = Math.min(
    Math.max(stepped, range.startMin),
    range.endMin - zoomMin,
  );
  return fromMinutes(clamped);
}

/**
 * F-01-133: технический перерыв визита из нескольких услуг. 'longest' — максимум из перерывов
 * услуг визита; 'sum' — сумма всех, не больше 60 минут (по ТЗ). Пустой список → 0.
 */
export function combineBreakMin(
  bufferValues: number[],
  mode: "longest" | "sum",
): number {
  if (bufferValues.length === 0) return 0;
  if (mode === "longest") return Math.max(...bufferValues);
  return Math.min(
    60,
    bufferValues.reduce((sum, v) => sum + v, 0),
  );
}

/** Не пересекает ли [aFrom,aTo) c [bFrom,bTo) */
export function overlaps(
  aFrom: Minutes,
  aTo: Minutes,
  bFrom: Minutes,
  bTo: Minutes,
): boolean {
  return aFrom < bTo && aTo > bFrom;
}

/** Свободные (белые) и нерабочие (серые) полосы колонки на весь диапазон дня */
export function hoursToBands(
  hours: DayHours,
  range: DayRange,
): { from: Minutes; to: Minutes; working: boolean }[] {
  const sorted = [...hours]
    .map((h) => ({ from: toMinutes(h.from), to: toMinutes(h.to) }))
    .sort((a, b) => a.from - b.from);
  const bands: { from: Minutes; to: Minutes; working: boolean }[] = [];
  let cursor = range.startMin;
  for (const h of sorted) {
    const from = Math.max(h.from, range.startMin);
    const to = Math.min(h.to, range.endMin);
    if (to <= from) continue;
    if (from > cursor) bands.push({ from: cursor, to: from, working: false });
    bands.push({ from, to, working: true });
    cursor = to;
  }
  if (cursor < range.endMin)
    bands.push({ from: cursor, to: range.endMin, working: false });
  return bands;
}
