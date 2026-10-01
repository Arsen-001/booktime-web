'use client';

/**
 * ⭐ «Клиент опаздывает» (29.09.2026, контроль рабочего дня): запись уже началась, прошло LATE_AFTER_MIN минут, а
 * «Пришёл» не отмечен — журнал подсвечивает карточку, «Требует внимания» даёт Пришёл / Позвонить / +15 мин / Не пришёл.
 * Только сегодня и только пока визит не закончился по времени: закончившийся без отметки — уже «незакрытый визит».
 */
import { useEffect, useState } from 'react';
import type { Booking, BookingStatus, ISODate } from '@/domain/core';
import { nowYerevan, today } from '@/lib/date';
import { startMinutes } from '@/areas/journal/lib/board';

/** Через сколько минут после начала визит без «Пришёл» считается опозданием */
export const LATE_AFTER_MIN = 10;

/** Ждём прихода: записан или клиент подтвердил. Заявки и ждущие предоплату — не «опаздывают», их ещё нет в дне */
const EXPECTED: BookingStatus[] = ['scheduled', 'client_confirmed'];

/** Минуты опоздания или null. Групповые занятия не считаем: участников много, приход отмечают в окне события */
export function lateMinutes(b: Booking, nowMin: number | null): number | null {
  if (nowMin === null || b.deletedAt || b.groupEventId || !EXPECTED.includes(b.status)) return null;
  const start = startMinutes(b);
  const late = nowMin - start;
  if (late < LATE_AFTER_MIN || nowMin >= start + b.durationMin) return null;
  return late;
}

/** Минуты «сейчас» по Еревану для выбранного дня (null — день не сегодня); обновляется раз в минуту */
export function useNowMinuteYerevan(date: ISODate): number | null {
  const read = () => {
    if (date !== today()) return null;
    const n = nowYerevan();
    return n.hour() * 60 + n.minute();
  };
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(read());
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, 30_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read зависит только от date
  }, [date]);
  return now;
}

/**
 * Сегодняшняя дата по Еревану, пересчёт раз в полминуты. Прямой today() в теле компонента React Compiler запоминает
 * до смены пропсов — журнал, открытый через полночь, считал бы «завтра» от вчерашнего дня.
 */
export function useTodayYerevan(): ISODate {
  const [day, setDay] = useState<ISODate>(() => today());
  useEffect(() => {
    const id = setInterval(() => setDay(today()), 30_000);
    return () => clearInterval(id);
  }, []);
  return day;
}

/** «Визит затянулся?»: за сколько минут до начала следующего клиента мастера предлагаем предупредить его */
export const OVERRUN_LOOKAHEAD_MIN = 15;
/** Сколько минут после конца визита вопрос ещё имеет смысл */
const OVERRUN_WINDOW_MIN = 30;

export interface Overrun {
  current: Booking;
  next: Booking;
  /** Минут прошло после конца по времени */
  overBy: number;
}

/**
 * ⭐ Визит «Пришёл» закончился по времени, а у того же мастера скоро (или уже) следующий клиент, который ещё не пришёл.
 * Статуса «визит окончен» у записи нет, поэтому это вопрос «ещё идёт?», а не утверждение: панель предлагает
 * предупредить следующего клиента о задержке (sendDelayNotice, F-00-059) или ответить «Закончили».
 */
export function findOverruns(bookings: Booking[], nowMin: number | null): Overrun[] {
  if (nowMin === null) return [];
  const out: Overrun[] = [];
  for (const b of bookings) {
    if (b.deletedAt || b.groupEventId || b.status !== 'arrived') continue;
    const end = startMinutes(b) + b.durationMin;
    if (nowMin < end || nowMin >= end + OVERRUN_WINDOW_MIN) continue;
    const next = bookings
      .filter(
        (x) =>
          x.id !== b.id &&
          !x.deletedAt &&
          x.staffId === b.staffId &&
          EXPECTED.includes(x.status) &&
          startMinutes(x) >= end - 5 &&
          startMinutes(x) <= nowMin + OVERRUN_LOOKAHEAD_MIN,
      )
      .sort((a, c) => a.start.localeCompare(c.start))[0];
    if (next) out.push({ current: b, next, overBy: nowMin - end });
  }
  return out.sort((a, c) => a.next.start.localeCompare(c.next.start));
}
