'use client';

import type { Id, Staff } from '@/domain/core';
import type { ScheduleRow } from '@/api/schedule';
import { isScheduleStaff } from '@/domain/schedule';

interface Shape {
  rows: number;
  idleToggle: boolean;
}

/** Последняя настоящая форма таблицы по бизнесу — в пределах вкладки (повторный заход рисует скелет ровно по ней) */
const lastShape = new Map<Id, Shape>();

/**
 * М2: скелет таблицы ровно той формы, что придёт: столько же видимых строк и строка «Без графика: N», если она будет.
 * Первый раз — по списку сотрудников (у кого есть услуги и колонка в журнале, тот обычно в графике), потом — по
 * прошлой загрузке этого бизнеса.
 */
export function useSkeletonShape(businessId: Id | undefined, staff: Staff[], rows: ScheduleRow[], loading: boolean): Shape {
  const key = businessId ?? '';
  if (!loading && rows.length > 0) {
    const active = rows.filter((r) => r.totalDays > 0).length;
    const shape = { rows: active > 0 ? active : rows.length, idleToggle: active > 0 && active < rows.length };
    const prev = lastShape.get(key);
    if (!prev || prev.rows !== shape.rows || prev.idleToggle !== shape.idleToggle) lastShape.set(key, shape);
    return shape;
  }
  const known = lastShape.get(key);
  if (known) return known;
  // Список сотрудников ещё не пришёл: обычно 5 мастеров и владелец/администратор без графика (строка «Без графика»)
  if (staff.length === 0) return { rows: 5, idleToggle: true };
  const inSchedule = staff.filter(isScheduleStaff);
  const masters = inSchedule.filter((s) => s.serviceIds.length > 0 && !s.hiddenInJournal).length;
  if (masters === 0) return { rows: Math.max(1, Math.min(inSchedule.length, 8)), idleToggle: false };
  return { rows: masters, idleToggle: masters < inSchedule.length };
}
