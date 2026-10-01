/**
 * Генерация дат серии повторов (F-01-100…107). Чистая функция — принадлежит разделу.
 * ⭐ По нашему решению интервал однозначен: «каждые N дней/недель» (N ≥ 1, N=1 — без пропусков),
 * без ловушки Altegio (там «Недель: 1» на деле значит «пропустить неделю», F-01-102).
 */
import type { ISODate } from "@/domain/core";
import type { RecurrenceFrequency, RecurrenceRule } from "@/domain/journal";
import { parse, toISODate, weekdayIndex } from "@/lib/date";

const FIXED_WEEKDAYS: Partial<Record<RecurrenceFrequency, number[]>> = {
  weekdays: [0, 1, 2, 3, 4],
  mon_wed_fri: [0, 2, 4],
  tue_thu: [1, 3],
};

/** Ограничитель на случай ошибочного правила (например, «Ежемесячно 31 числа» в феврале, конца нет) */
const SAFETY_MAX_DATES = 366;

/**
 * Даты будущих повторов (без исходной записи — F-01-103: она уже создана и в список не входит).
 * startDate — дата ПЕРВОГО повтора (не дата исходной записи).
 */
export function generateOccurrenceDates(rule: RecurrenceRule): ISODate[] {
  const out: ISODate[] = [];
  const everyN = Math.max(1, rule.everyN || 1);
  const endDate = rule.endMode === "date" ? rule.endDate : undefined;
  const maxCount =
    rule.endMode === "count" ? Math.max(1, rule.count || 1) : SAFETY_MAX_DATES;

  const fixed = FIXED_WEEKDAYS[rule.frequency];
  const push = (d: ISODate): boolean => {
    if (endDate && d > endDate) return false;
    out.push(d);
    return out.length < maxCount;
  };

  if (rule.frequency === "daily") {
    let cursor = parse(rule.startDate);
    let guard = 0;
    while (out.length < maxCount && guard < SAFETY_MAX_DATES * everyN) {
      guard += 1;
      const d = toISODate(cursor);
      if (!push(d)) break;
      cursor = cursor.add(everyN, "day");
    }
    return out;
  }

  if (fixed) {
    // Наборы дней недели без счётчика интервала (F-01-102: интервал есть только у «Ежедневно»/«Еженедельно»)
    let cursor = parse(rule.startDate);
    let guard = 0;
    while (out.length < maxCount && guard < SAFETY_MAX_DATES) {
      guard += 1;
      if (fixed.includes(weekdayIndex(toISODate(cursor)))) {
        if (!push(toISODate(cursor))) break;
      }
      cursor = cursor.add(1, "day");
    }
    return out;
  }

  if (rule.frequency === "weekly") {
    const days =
      rule.weekdays.length > 0 ? rule.weekdays : [weekdayIndex(rule.startDate)];
    // dayjs в этом проекте уже настроен на неделю с понедельника (startOf('week') === сам понедельник) —
    // проверено `npx tsx`: без этой правки «Еженедельно, четверг» сдвигало все даты на пятницу.
    let weekStart = parse(rule.startDate).startOf("week");
    let guard = 0;
    while (out.length < maxCount && guard < 200) {
      guard += 1;
      for (const day of [...days].sort((a, b) => a - b)) {
        const d = toISODate(weekStart.add(day, "day"));
        if (d < rule.startDate) continue;
        if (!push(d)) return out;
      }
      weekStart = weekStart.add(everyN, "week");
    }
    return out;
  }

  if (rule.frequency === "monthly") {
    let cursor = parse(rule.startDate);
    let guard = 0;
    while (out.length < maxCount && guard < SAFETY_MAX_DATES) {
      guard += 1;
      if (!push(toISODate(cursor))) break;
      cursor = cursor.add(1, "month");
    }
    return out;
  }

  // yearly
  let cursor = parse(rule.startDate);
  let guard = 0;
  while (out.length < maxCount && guard < SAFETY_MAX_DATES) {
    guard += 1;
    if (!push(toISODate(cursor))) break;
    cursor = cursor.add(1, "year");
  }
  return out;
}
