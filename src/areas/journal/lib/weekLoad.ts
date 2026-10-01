/**
 * «Загрузка недели» журнала: тепловая карта «мастер × день» на 7 дней. Чистые функции без React — экран зовёт
 * buildWeekLoad один раз на пришедшие данные (useMemo). Доля — те же правила, что у полоски загрузки в шапке
 * колонки (staffLoad) и у «свободных окон» дня (freeGaps): цифры в карте и в журнале совпадают.
 */
import type { Booking, DayHours, ISODate, Id, Minutes } from '@/domain/core';
import { datePart, toMinutes } from '@/lib/date';
import { FREE_SLOT_MIN, freeGaps, isActiveBooking, staffLoad, type Gap } from '@/areas/journal/lib/board';

export interface WeekLoadCell {
  date: ISODate;
  /** Рабочих минут по графику (0 — выходной) */
  workMin: Minutes;
  /** Минут, занятых активными записями (не больше рабочих) */
  bookedMin: Minutes;
  /** 0…1 — как полоска загрузки в шапке колонки */
  ratio: number;
  /** Активных записей */
  count: number;
  /** Свободные окна от FREE_SLOT_MIN — те же, что «свободные окна» дня */
  gaps: Gap[];
  off: boolean;
}

export interface WeekLoadTotal {
  workMin: Minutes;
  bookedMin: Minutes;
  ratio: number;
}

export interface WeekLoadRow extends WeekLoadTotal {
  staffId: Id;
  cells: WeekLoadCell[];
}

export interface WeekLoadModel {
  rows: WeekLoadRow[];
  /** Итог по каждому дню (все мастера) — в порядке days */
  days: WeekLoadTotal[];
  total: WeekLoadTotal;
}

const workMinutes = (hours: DayHours): Minutes =>
  hours.reduce((sum, h) => sum + Math.max(0, toMinutes(h.to) - toMinutes(h.from)), 0);

const ratioOf = (booked: Minutes, work: Minutes) => (work > 0 ? Math.min(1, booked / work) : 0);

export function buildWeekLoad(
  staffIds: Id[],
  days: ISODate[],
  hours: Record<Id, Record<ISODate, DayHours>>,
  bookings: Booking[],
): WeekLoadModel {
  // Записи раскладываем один раз: мастер → день → записи (без повторного прохода на каждую клетку)
  const byStaffDay = new Map<string, Booking[]>();
  for (const b of bookings) {
    if (!isActiveBooking(b)) continue;
    const key = `${b.staffId}|${datePart(b.start)}`;
    const list = byStaffDay.get(key);
    if (list) list.push(b);
    else byStaffDay.set(key, [b]);
  }

  const dayWork = days.map(() => 0);
  const dayBooked = days.map(() => 0);
  const rows: WeekLoadRow[] = staffIds.map((staffId) => {
    let rowWork = 0;
    let rowBooked = 0;
    const cells = days.map((date, i): WeekLoadCell => {
      const dayHours = hours[staffId]?.[date] ?? [];
      const list = byStaffDay.get(`${staffId}|${date}`) ?? [];
      const workMin = workMinutes(dayHours);
      const load = staffLoad(dayHours, list);
      const bookedMin = Math.min(workMin, list.reduce((sum, b) => sum + b.durationMin, 0));
      rowWork += workMin;
      rowBooked += bookedMin;
      dayWork[i] += workMin;
      dayBooked[i] += bookedMin;
      return {
        date,
        workMin,
        bookedMin,
        ratio: load.ratio,
        count: load.count,
        gaps: workMin > 0 ? freeGaps(dayHours, list, FREE_SLOT_MIN) : [],
        off: workMin === 0,
      };
    });
    return { staffId, cells, workMin: rowWork, bookedMin: rowBooked, ratio: ratioOf(rowBooked, rowWork) };
  });

  const totalWork = dayWork.reduce((a, b) => a + b, 0);
  const totalBooked = dayBooked.reduce((a, b) => a + b, 0);
  return {
    rows,
    days: days.map((_, i) => ({ workMin: dayWork[i], bookedMin: dayBooked[i], ratio: ratioOf(dayBooked[i], dayWork[i]) })),
    total: { workMin: totalWork, bookedMin: totalBooked, ratio: ratioOf(totalBooked, totalWork) },
  };
}

/** Ступень тепловой карты 0…5: 0 — пусто, 5 — почти всё занято */
export function loadLevel(ratio: number): 0 | 1 | 2 | 3 | 4 | 5 {
  if (ratio <= 0) return 0;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  if (ratio < 0.9) return 4;
  return 5;
}
