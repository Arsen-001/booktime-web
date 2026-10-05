/**
 * ЗАНЯТОСТЬ МАСТЕРА — единый источник правды (F-00-045/046/051/056/057, F-01-034/215, arch-a1 №2).
 * Отвечает на вопрос «свободно ли в 15:00» одинаково для журнала, приложения клиента и виджета.
 * Чистые функции над CoreData: без React, без стора — переносятся на сервер как есть.
 *
 * Хозяин правил занятости и окон — раздел schedule (развивает: время на дорогу, ресурсы, правила слотов Altegio),
 * сигнатуры сохраняет. Остальные только вызывают. Время внутри дня — минуты от полуночи.
 */
import type {
  Booking,
  CoreData,
  DayHours,
  ISODate,
  ISODateTime,
  Id,
  Minutes,
  TimeRange,
  WorkSchedule,
  Workplace,
} from '@/domain/core';
import { combine, datePart, fromMinutes, toMinutes, weekdayIndex } from '@/lib/date';
import { occupiesTime } from '@/domain/rules/booking-status';
import { isPrepaymentExpired } from '@/domain/rules/booking-policy';

/** [начало, конец) в минутах от полуночи */
export type Interval = readonly [number, number];

// ─────────────────────────── Интервалы ───────────────────────────

/** Пересекаются ли [a0, a1) и [b0, b1) (касание концами — не пересечение) */
export function overlaps(a: Interval, b: Interval): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/** Интервалы дня из 'HH:mm'-диапазонов; пустые и перевёрнутые отбрасываются */
export function rangesToIntervals(ranges: readonly TimeRange[]): Interval[] {
  return ranges.map((r) => [toMinutes(r.from), toMinutes(r.to)] as const).filter(([a, b]) => b > a);
}

export function intervalsToRanges(list: readonly Interval[]): TimeRange[] {
  return list.map(([a, b]) => ({ from: fromMinutes(a), to: fromMinutes(b) }));
}

/** Вычесть cut из каждого интервала */
export function subtractInterval(list: readonly Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const [a, b] of list) {
    if (cut[1] <= a || cut[0] >= b) out.push([a, b]);
    else {
      if (cut[0] > a) out.push([a, cut[0]]);
      if (cut[1] < b) out.push([cut[1], b]);
    }
  }
  return out;
}

export function intersectIntervals(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [a1, a2] of a)
    for (const [b1, b2] of b) {
      const s = Math.max(a1, b1);
      const e = Math.min(a2, b2);
      if (e > s) out.push([s, e]);
    }
  return out;
}

/** Объединить пересекающиеся и соприкасающиеся, по возрастанию */
export function mergeIntervals(list: readonly Interval[]): Interval[] {
  const sorted = [...list].sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

// ─────────────────────────── Часы работы ───────────────────────────

/** Часы одного графика на дату: исключение на дату важнее шаблона недели; [] — выходной */
export function scheduleHours(schedule: Pick<WorkSchedule, 'overrides' | 'week'>, date: ISODate): DayHours {
  return schedule.overrides[date] ?? schedule.week[weekdayIndex(date)] ?? [];
}

/**
 * Рабочие часы мастера на дату — ОБЪЕДИНЕНИЕ всех его графиков (мастер может работать в нескольких местах,
 * F-00-045); с locationId — только графики этого филиала. Отметки календаря сюда не входят (это «часы смены»,
 * их показывает сетка журнала и графика) — доступность для записи считает staffWorkIntervals().
 */
export function staffDayHours(core: Pick<CoreData, 'schedules'>, staffId: Id, date: ISODate, locationId?: Id): DayHours {
  const ranges: TimeRange[] = [];
  for (const s of core.schedules) {
    if (s.staffId !== staffId || (locationId && s.locationId !== locationId)) continue;
    ranges.push(...scheduleHours(s, date));
  }
  return intervalsToRanges(mergeIntervals(rangesToIntervals(ranges)));
}

/** Перерывы дня — промежутки между рабочими интервалами (F-02: перерыв = «дырка» в часах) */
export function dayBreaks(hours: readonly TimeRange[]): TimeRange[] {
  const merged = mergeIntervals(rangesToIntervals(hours));
  const out: TimeRange[] = [];
  for (let i = 1; i < merged.length; i++) out.push({ from: fromMinutes(merged[i - 1][1]), to: fromMinutes(merged[i][0]) });
  return out;
}

/** Интервал, в который мастер доступен для записи, с местом */
export interface WorkInterval {
  from: Minutes;
  to: Minutes;
  locationId: Id;
  workplace: Workplace;
}

export interface WorkQuery {
  locationId?: Id;
  /** Только графики этого места работы (если у мастера такой есть; иначе фильтр не применяется) */
  workplace?: Workplace;
}

/**
 * Когда мастер доступен для записи в дату — с учётом режима календаря (F-00-051):
 *  - «всё свободно» (calendarMode 'free'): часы графика минус отметки «занято»;
 *  - «всё занято» ('busy'): только часы, открытые отметками «свободно» (привязываются к графику того же места работы).
 * Записи здесь НЕ вычитаются — это busyIntervals().
 */
export function staffWorkIntervals(core: CoreData, staffId: Id, date: ISODate, q: WorkQuery = {}): WorkInterval[] {
  const staff = core.staff.find((s) => s.id === staffId);
  if (!staff || staff.status !== 'active') return [];
  // F-00-055: после openUntil график закрыт — окон нет (часы смены в журнале при этом видны, см. staffDayHours)
  let schedules = core.schedules.filter(
    (s) => s.staffId === staffId && (!q.locationId || s.locationId === q.locationId) && (!s.openUntil || date <= s.openUntil),
  );
  if (q.workplace && schedules.some((s) => s.workplace === q.workplace)) {
    schedules = schedules.filter((s) => s.workplace === q.workplace);
  }
  if (!schedules.length) return [];
  const marks = core.calendarMarks.filter((m) => m.staffId === staffId && m.date === date);
  const out: WorkInterval[] = [];

  if (staff.calendarMode === 'busy') {
    for (const m of marks) {
      if (m.kind !== 'free') continue;
      const sch = schedules.find((s) => m.workplace && s.workplace === m.workplace) ?? schedules[0];
      for (const [from, to] of rangesToIntervals([m])) out.push({ from, to, locationId: sch.locationId, workplace: sch.workplace });
    }
  } else {
    const busyMarks = marks.filter((m) => m.kind === 'busy');
    for (const sch of schedules) {
      let free = rangesToIntervals(scheduleHours(sch, date));
      for (const cut of rangesToIntervals(busyMarks)) free = subtractInterval(free, cut);
      for (const [from, to] of free) out.push({ from, to, locationId: sch.locationId, workplace: sch.workplace });
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

// ─────────────────────────── Занятость ───────────────────────────

export type BusyKind = 'booking' | 'group' | 'mark';

/** Занятый промежуток мастера. to — с запасом после услуги; serviceTo — конец самой услуги */
export interface BusyInterval {
  from: Minutes;
  to: Minutes;
  serviceTo: Minutes;
  kind: BusyKind;
  bookingId?: Id;
  groupEventId?: Id;
  businessId?: Id;
  locationId?: Id;
  workplace?: Workplace;
  /** Чья запись (Staff.id): у одного человека может быть несколько карточек в разных бизнесах */
  staffId: Id;
}

/**
 * Все карточки того же человека (F-00-045: мастер и в салоне, и сам по себе — запись в одном месте закрывает время
 * в другом). Сейчас связь — по номеру телефона; нет номера — только сам staffId.
 */
export function samePersonStaffIds(core: Pick<CoreData, 'staff'>, staffId: Id): Id[] {
  const me = core.staff.find((s) => s.id === staffId);
  if (!me?.phone) return [staffId];
  const ids = core.staff.filter((s) => s.phone === me.phone).map((s) => s.id);
  return ids.includes(staffId) ? ids : [staffId, ...ids];
}

/** Запас после записи — самый длинный «технический перерыв» её услуг (F-00-057; у услуги Service.bufferAfterMin) */
export function bookingBufferAfter(core: Pick<CoreData, 'services'>, booking: Pick<Booking, 'services'>): Minutes {
  let max = 0;
  for (const line of booking.services) {
    const svc = core.services.find((s) => s.id === line.serviceId);
    if (svc?.bufferAfterMin && svc.bufferAfterMin > max) max = svc.bufferAfterMin;
  }
  return max;
}

export interface BusyOptions {
  /** Не считать эту запись (перенос/редактирование самой себя) */
  excludeBookingId?: Id;
  /** Учитывать запас после услуги (по умолчанию да) */
  withBuffers?: boolean;
  /** Отметки «занято» тоже вернуть (для показа в календаре; окна их уже учитывают через staffWorkIntervals) */
  withMarks?: boolean;
  /** «Сейчас»: запись «ждёт предоплату» с истёкшим holdUntil время уже не держит (F-00-097, F-02-071) */
  now?: ISODateTime;
}

/** Занятость мастера (всех его карточек) в дату: записи, групповые события, по желанию отметки «занято» */
export function busyIntervals(core: CoreData, staffId: Id, date: ISODate, opts: BusyOptions = {}): BusyInterval[] {
  const withBuffers = opts.withBuffers ?? true;
  const people = samePersonStaffIds(core, staffId);
  const out: BusyInterval[] = [];
  for (const b of core.bookings) {
    if (b.id === opts.excludeBookingId || !occupiesTime(b) || datePart(b.start) !== date) continue;
    if (opts.now && isPrepaymentExpired(b, opts.now)) continue;
    const owner = people.includes(b.staffId) ? b.staffId : people.find((id) => b.services.some((l) => l.staffId === id));
    if (!owner) continue;
    const from = toMinutes(b.start.slice(11, 16));
    const serviceTo = from + b.durationMin;
    out.push({
      from,
      serviceTo,
      to: serviceTo + (withBuffers ? bookingBufferAfter(core, b) : 0),
      kind: 'booking',
      bookingId: b.id,
      businessId: b.businessId,
      locationId: b.locationId,
      workplace: b.workplace,
      staffId: owner,
    });
  }
  for (const e of core.groupEvents) {
    if (e.status !== 'scheduled' || !people.includes(e.staffId) || datePart(e.start) !== date) continue;
    const from = toMinutes(e.start.slice(11, 16));
    const serviceTo = from + e.durationMin;
    const svc = core.services.find((s) => s.id === e.serviceId);
    out.push({
      from,
      serviceTo,
      to: serviceTo + (withBuffers ? (svc?.bufferAfterMin ?? 0) : 0),
      kind: 'group',
      groupEventId: e.id,
      businessId: e.businessId,
      locationId: e.locationId,
      staffId: e.staffId,
    });
  }
  if (opts.withMarks) {
    for (const m of core.calendarMarks) {
      if (m.kind !== 'busy' || m.date !== date || !people.includes(m.staffId)) continue;
      const [from, to] = [toMinutes(m.from), toMinutes(m.to)];
      if (to > from) out.push({ from, to, serviceTo: to, kind: 'mark', workplace: m.workplace, staffId: m.staffId });
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

/** Занятость, которую можно показать смотрящему (F-00-046): чужое — только «занято · дома 15:00–16:30», без имени и суммы */
export interface BusyForViewer {
  from: Minutes;
  to: Minutes;
  kind: BusyKind | 'foreign';
  workplace?: Workplace;
  /** Есть только у своих записей — по нему можно открыть запись */
  bookingId?: Id;
  groupEventId?: Id;
}

/**
 * Обезличить занятость для смотрящего из бизнеса viewerBusinessId: записи чужого бизнеса и домашние/выездные записи
 * (их видит только сам мастер — viewerStaffIds) → kind 'foreign' без id. Имя клиента и сумма сюда не попадают никогда.
 */
export function busyForViewer(
  list: readonly BusyInterval[],
  viewer: { businessId: Id; staffIds?: readonly Id[] },
): BusyForViewer[] {
  return list.map((i) => {
    const own = i.businessId === viewer.businessId;
    const privatePlace = i.workplace === 'home' || i.workplace === 'visit';
    const isSelf = viewer.staffIds?.includes(i.staffId) ?? false;
    if (i.kind === 'mark' || (own && (!privatePlace || isSelf))) {
      return { from: i.from, to: i.serviceTo, kind: i.kind, workplace: i.workplace, bookingId: i.bookingId, groupEventId: i.groupEventId };
    }
    return { from: i.from, to: i.serviceTo, kind: 'foreign', workplace: i.workplace };
  });
}

// ─────────────────────────── Свободно ли время ───────────────────────────

export interface SlotCheckQuery {
  staffId: Id;
  /** 'YYYY-MM-DDTHH:mm' */
  start: ISODateTime;
  /** Бронируемая длительность (для «от–до» — верхняя граница, rules/pricing bookedDuration) */
  durationMin: Minutes;
  /** Запас после услуги */
  bufferAfterMin?: Minutes;
  locationId?: Id;
  workplace?: Workplace;
  excludeBookingId?: Id;
  /** Проверять часы работы (журнал может записать вне графика с предупреждением, F-01-215) */
  checkHours?: boolean;
  /** Проверять, что время не в прошлом */
  checkPast?: boolean;
}

export type SlotCheck =
  | { ok: true; locationId?: Id; workplace?: Workplace }
  | { ok: false; reason: 'past' | 'outside_hours' | 'busy' | 'home_during_shift'; conflictBookingId?: Id };

// ─────────────────────────── Домашняя запись в часы смены (F-00-047) ───────────────────────────

/** Места «не в салоне»: домашняя запись и выезд к клиенту */
const HOME_WORKPLACES: ReadonlySet<Workplace> = new Set<Workplace>(['home', 'visit']);
/** Графики, которые сменой в салоне не считаются */
const NOT_SHIFT_WORKPLACES: ReadonlySet<Workplace> = new Set<Workplace>(['home', 'visit', 'online']);

export interface HomeShiftConflict {
  /** Салон, в чьей смене стоит домашняя запись */
  businessId: Id;
  staffId: Id;
  /** Часы смены 'HH:mm' */
  from: string;
  to: string;
}

/**
 * Галочка владельца «Запретить мастерам домашние записи в часы смены» (Business.forbidHomeBookingsDuringShift, F-00-047):
 * домашняя или выездная запись мастера не может стоять на часах его смены в таком салоне — ни в салоне, ни в его
 * собственном бизнесе (тот же человек, samePersonStaffIds). Смена — часы графиков салона, кроме домашних, выездных
 * и онлайн. Касание концами — не пересечение. Как сервер (availability/home-shift.ts, BookingsService.occupyBooking).
 */
export function homeShiftConflict(
  core: Pick<CoreData, 'staff' | 'businesses' | 'schedules'>,
  q: { staffId: Id; start: ISODateTime; durationMin: Minutes; workplace?: Workplace },
): HomeShiftConflict | null {
  if (!q.workplace || !HOME_WORKPLACES.has(q.workplace)) return null;
  const date = datePart(q.start);
  const from = toMinutes(q.start.slice(11, 16));
  const need: Interval = [from, Math.min(from + q.durationMin, 24 * 60)];
  for (const id of samePersonStaffIds(core, q.staffId)) {
    const card = core.staff.find((s) => s.id === id);
    if (!card || card.status !== 'active') continue;
    if (!core.businesses.find((b) => b.id === card.businessId)?.forbidHomeBookingsDuringShift) continue;
    for (const sch of core.schedules) {
      if (sch.staffId !== id || NOT_SHIFT_WORKPLACES.has(sch.workplace) || (sch.openUntil && date > sch.openUntil)) continue;
      const hit = rangesToIntervals(scheduleHours(sch, date)).find((r) => overlaps(need, r));
      if (hit) return { businessId: card.businessId, staffId: id, from: fromMinutes(hit[0]), to: fromMinutes(hit[1]) };
    }
  }
  return null;
}

/**
 * Свободно ли [start, start + длительность + запас) у мастера — ОДНО правило для журнала, приложения и виджета.
 * Порядок причин: прошлое → вне часов → занято (двойная запись невозможна, F-00-045).
 */
export function checkSlot(core: CoreData, q: SlotCheckQuery, now: ISODateTime): SlotCheck {
  const checkHours = q.checkHours ?? true;
  const checkPast = q.checkPast ?? true;
  if (checkPast && q.start < now) return { ok: false, reason: 'past' };
  const date = datePart(q.start);
  const from = toMinutes(q.start.slice(11, 16));
  const need: Interval = [from, from + q.durationMin + (q.bufferAfterMin ?? 0)];
  let place: WorkInterval | undefined;
  if (checkHours) {
    place = staffWorkIntervals(core, q.staffId, date, { locationId: q.locationId, workplace: q.workplace }).find(
      (w) => w.from <= need[0] && need[1] <= w.to,
    );
    if (!place) return { ok: false, reason: 'outside_hours' };
  }
  const conflict = busyIntervals(core, q.staffId, date, { excludeBookingId: q.excludeBookingId, now }).find((b) =>
    overlaps(need, [b.from, b.to]),
  );
  if (conflict) return { ok: false, reason: 'busy', conflictBookingId: conflict.bookingId };
  const workplace = place?.workplace ?? q.workplace;
  if (homeShiftConflict(core, { staffId: q.staffId, start: q.start, durationMin: q.durationMin, workplace })) return { ok: false, reason: 'home_during_shift' };
  return { ok: true, locationId: place?.locationId ?? q.locationId, workplace };
}

/** Короткая форма: true — время свободно по всем правилам */
export function isSlotFree(core: CoreData, q: SlotCheckQuery, now: ISODateTime): boolean {
  return checkSlot(core, q, now).ok;
}

/**
 * Пересекается ли время с другой записью мастера (без проверки часов и прошлого) — замена journal.computeOverlap.
 * Запас после услуги НЕ учитывается, как в журнале Altegio (перерыв видно, но поставить вплотную сотрудник может).
 */
export function hasBookingOverlap(
  core: CoreData,
  staffId: Id,
  start: ISODateTime,
  durationMin: Minutes,
  excludeBookingId?: Id,
): boolean {
  const from = toMinutes(start.slice(11, 16));
  const need: Interval = [from, from + durationMin];
  return busyIntervals(core, staffId, datePart(start), { excludeBookingId, withBuffers: false }).some((b) =>
    overlaps(need, [b.from, b.to]),
  );
}

/** 'YYYY-MM-DD' + минуты → 'YYYY-MM-DDTHH:mm' */
export function atMinutes(date: ISODate, minutes: Minutes): ISODateTime {
  return combine(date, fromMinutes(minutes));
}
