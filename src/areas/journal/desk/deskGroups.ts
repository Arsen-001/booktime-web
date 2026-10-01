/**
 * Стойка администратора (⭐ рабочий день №10): как разложить визиты дня по группам. Чистая функция — без React и базы.
 *  · late    — время визита уже идёт, а прихода нет (клиент «должен быть здесь»): сверху, красным;
 *  · soon    — начнётся в ближайший час;
 *  · later   — позже сегодня;
 *  · inSalon — пришли и визит ещё не кончился (мелко, внизу — «Пришёл» в одно касание уже не нужен).
 * Визиты, у которых время прошло, а прихода так и нет, — не дело стойки: это «незакрытые визиты» конца дня.
 * Отменённые, «не пришёл», удалённые и участники групповых занятий (приход отмечают в окне занятия) — не показываем.
 */
import type { Booking, BookingStatus, Id } from '@/domain/core';

/** До прихода: из этих статусов «Пришёл» — следующий шаг */
export const DESK_WAITING: readonly BookingStatus[] = ['awaiting_confirmation', 'awaiting_prepayment', 'scheduled', 'client_confirmed'];

/** «Скоро» — начнётся в пределах этого числа минут */
export const DESK_SOON_MIN = 60;

export interface DeskGroups {
  late: Booking[];
  soon: Booking[];
  later: Booking[];
  inSalon: Booking[];
  /** Сколько всего пришло сегодня (и ушло) — для счётчика */
  arrivedCount: number;
}

const minutesOf = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));

export function deskGroups(bookings: readonly Booking[], nowMin: number, onlyStaffIds?: readonly Id[]): DeskGroups {
  const out: DeskGroups = { late: [], soon: [], later: [], inSalon: [], arrivedCount: 0 };
  const sorted = [...bookings].sort((a, b) => a.start.localeCompare(b.start));
  for (const b of sorted) {
    if (b.deletedAt || b.groupEventId) continue;
    if (onlyStaffIds && onlyStaffIds.length > 0 && !onlyStaffIds.includes(b.staffId)) continue;
    const start = minutesOf(b.start);
    const end = start + b.durationMin;
    if (b.status === 'arrived') {
      out.arrivedCount += 1;
      if (end > nowMin) out.inSalon.push(b);
      continue;
    }
    if (!DESK_WAITING.includes(b.status)) continue;
    if (end <= nowMin) continue;
    if (start <= nowMin) out.late.push(b);
    else if (start - nowMin <= DESK_SOON_MIN) out.soon.push(b);
    else out.later.push(b);
  }
  return out;
}
