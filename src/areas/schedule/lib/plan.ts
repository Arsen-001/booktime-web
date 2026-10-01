/**
 * План графика для панели и окон раздела (Г2, Г10, Г12): какие клетки станут рабочими с какими часами, а какие —
 * днями отдыха. План ЗАМЕНЯЕТ график в периоде: дни отдыха по циклу снимают старые рабочие часы (Г2 — раньше шаблон
 * ложился поверх и получалась смесь старого и нового). Предпросмотр и запись считает один и тот же расчёт в api.
 */
import type { DayHours, Id, ISODate } from '@/domain/core';
import type { DayTypeId } from '@/domain/schedule';
import { dayTypeById } from '@/domain/schedule';
import type { CellSnapshot, PlanEntry } from '@/api/schedule';
import { addDays, eachDay, weekdayIndex } from '@/lib/date';

export type TemplateMode = 'none' | 'weekdays' | 'shifts';

export interface TemplatePlanInput {
  mode: TemplateMode;
  staffIds: Id[];
  /** mode='none' — ровно выбранные клетки */
  cells: { staffId: Id; date: ISODate }[];
  anchor: ISODate;
  weeks: number;
  weekdays: number[];
  /** Г10: свои часы на день недели; нет ключа — общие часы */
  weekdayHours: Partial<Record<number, DayHours>>;
  hours: DayHours;
  shiftWork: number;
  shiftOff: number;
  /** Г10: первый рабочий день цикла у мастера — сдвиг в днях от anchor (0 — с anchor) */
  offsets: Record<Id, number>;
  typeId: DayTypeId;
  note?: string;
}

/** Сколько дней охватывает шаблон: недели от якоря, не больше 30 недель (F-02-033) */
export function templateDays(anchor: ISODate, weeks: number): ISODate[] {
  const n = Math.max(1, Math.min(30, weeks)) * 7;
  return Array.from({ length: n }, (_, i) => addDays(anchor, i));
}

export function templatePlan(p: TemplatePlanInput): PlanEntry[] {
  const working = dayTypeById(p.typeId).working;
  const work = (staffId: Id, date: ISODate, hours: DayHours): PlanEntry =>
    working
      ? { staffId, date, hours, ...(p.typeId !== 'work' ? { typeId: p.typeId } : {}), ...(p.note !== undefined ? { note: p.note } : {}) }
      : { staffId, date, hours: null, typeId: p.typeId, ...(p.note !== undefined ? { note: p.note } : {}) };
  // Нерабочий тип (отпуск и т. п.) шаблоном ставится только на «рабочие» дни цикла; дни отдыха не трогаем
  const rest = (staffId: Id, date: ISODate): PlanEntry[] => (working ? [{ staffId, date, hours: null }] : []);

  if (p.mode === 'none') return p.cells.map((c) => work(c.staffId, c.date, p.hours));
  const days = templateDays(p.anchor, p.weeks);
  if (p.mode === 'weekdays')
    return p.staffIds.flatMap((staffId) =>
      days.flatMap((date) => {
        const wd = weekdayIndex(date);
        return p.weekdays.includes(wd) ? [work(staffId, date, p.weekdayHours[wd] ?? p.hours)] : rest(staffId, date);
      }),
    );
  const cycle = Math.max(1, p.shiftWork + p.shiftOff);
  return p.staffIds.flatMap((staffId) =>
    days.flatMap((date, i) => {
      const pos = (((i - (p.offsets[staffId] ?? 0)) % cycle) + cycle) % cycle;
      return pos < p.shiftWork ? [work(staffId, date, p.hours)] : rest(staffId, date);
    }),
  );
}

/**
 * Г12: «Повторить неделю до даты» — неделя-образец (слепок) повторяется день в день по дням недели с понедельника
 * следующей недели до until включительно. Нерабочие дни образца — дни отдыха (отпуск не размножаем).
 */
export function repeatWeekPlan(source: CellSnapshot[], sourceWeekStart: ISODate, until: ISODate): PlanEntry[] {
  const start = addDays(sourceWeekStart, 7);
  if (until < start) return [];
  const byKey = new Map(source.map((c) => [`${c.staffId}|${weekdayIndex(c.date)}`, c]));
  const staffIds = [...new Set(source.map((c) => c.staffId))];
  const dates = eachDay(start, until);
  return staffIds.flatMap((staffId) =>
    dates.map((date): PlanEntry => {
      const c = byKey.get(`${staffId}|${weekdayIndex(date)}`);
      const works = Boolean(c && c.hours.length > 0 && dayTypeById(c.typeId).working);
      return { staffId, date, hours: works && c ? c.hours : null };
    }),
  );
}
