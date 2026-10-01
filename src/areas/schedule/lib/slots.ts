/**
 * Помощники экрана «Доступное время для онлайн-записи» (b02). Файл принадлежит разделу schedule.
 * Сама модель и движок расчёта — в src/domain/schedule.ts и src/api/schedule.ts.
 */
import type { DayPart, SlotDensity, SlotRule, SlotStartMode } from '@/domain/schedule';
import { partOfDay, SLOT_STEP_MAX, SLOT_STEP_MIN } from '@/domain/schedule';
import { fromMinutes, toMinutes } from '@/lib/date';

export const DENSITY_OPTIONS: SlotDensity[] = ['fixed', 'optimal', 'dynamic'];
export const START_MODE_OPTIONS: SlotStartMode[] = ['from_window', 'from_shift_start'];
export const DAY_PARTS: DayPart[] = ['morning', 'day', 'evening'];

/** Шаги мастера «Редактировать правила» (F-02-045): при «Динамичном» — 3 (плотность → шаг → время до визита) */
export type WizardStepId = 'density' | 'start' | 'step' | 'lead' | 'manual';

export function wizardSteps(density: SlotDensity): WizardStepId[] {
  return density === 'dynamic' ? ['density', 'step', 'lead'] : ['density', 'start', 'step', 'lead', 'manual'];
}

/** Список шагов записи (мин) для выбора: 5…420 с шагом 5 (F-02-051) */
export function stepOptions(): number[] {
  const out: number[] = [];
  for (let m = SLOT_STEP_MIN; m <= SLOT_STEP_MAX; m += 5) out.push(m);
  return out;
}

/** Список времени до визита: «Не выбрано» + 30мин…24ч с шагом 30 (F-02-052) */
export function leadTimeOptions(): number[] {
  const out: number[] = [];
  for (let m = 30; m <= 24 * 60; m += 30) out.push(m);
  return out;
}

/** Сетка кнопок «Утро/День/Вечер» окна правила ЧИСТО от окна и шага, без записей (F-02-044: «00:00–24:00, шаг 30 — 48 слотов») */
export function windowGrid(rule: SlotRule): string[] {
  if (rule.startMode !== 'from_window') return [];
  const start = toMinutes(rule.windowFrom);
  const end = toMinutes(rule.windowTo);
  const out: string[] = [];
  for (let t = start; t < end; t += rule.stepMin) out.push(fromMinutes(t));
  return out;
}

export function groupByPart(times: string[]): Record<DayPart, string[]> {
  const out: Record<DayPart, string[]> = { morning: [], day: [], evening: [] };
  for (const t of times) out[partOfDay(t)].push(t);
  return out;
}
