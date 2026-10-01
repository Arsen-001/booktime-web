/**
 * ПРАВИЛА ЗАПИСИ, ОТМЕНЫ, ПЕРЕНОСА, НЕЯВКИ — единый источник правды (F-00-066/067/071/079/097/098/099/100,
 * F-03-066/067, arch-a1 №3). Хозяин настроек — раздел online (пишет Business.bookingRules / Staff.bookingRules),
 * остальные читают ТОЛЬКО через эти функции. Черновики сроков в срезах client/online удаляются.
 *
 * Решения ядра (25.09.2026):
 *  - правило мастера важнее правила бизнеса (F-00-066: «правило у каждого мастера»);
 *  - срок по умолчанию — 3 ч и для отмены, и для переноса (дефолт хозяина правил online; числа в ТЗ не решены);
 *  - отменить позже срока клиент МОЖЕТ, но это неявка (F-00-098, решено): статус «Отменил клиент» (окно
 *    освобождается и уходит листу ожидания, F-00-101), флаг Booking.cancelledLate и +1 к Client.noShowCount.
 *    Ставить «Не пришёл» до визита нельзя — окно осталось бы занятым;
 *  - начавшуюся или прошедшую запись клиент не отменяет и не переносит (F-03-066 «Готово, когда»);
 *  - предоплаченную запись клиент сам отменяет при allowCancelPrepaid (⭐ по умолчанию да, владелец 29.09.2026: до
 *    срока мастера — с возвратом, позже — предоплата остаётся мастеру) и переносит при allowReschedulePrepaid (по
 *    умолчанию нет, как у Altegio); неоплаченная предоплата не мешает;
 *  - статус новой записи: сотрудник → «Записан»; клиент → выезд ВСЕГДА «Ждёт подтверждения» (F-00-079) →
 *    предоплата мастера «Ждёт предоплату» (F-00-097) → «Только мои клиенты» для чужого (F-00-065) и ручное
 *    подтверждение «Ждёт подтверждения» (F-00-067) → иначе «Записан».
 */
import type {
  AppUser,
  Booking,
  BookingRules,
  BookingSource,
  BookingStatus,
  Business,
  Client,
  ISODate,
  ISODateTime,
  Id,
  Minutes,
  NoShowPrepaymentRule,
  PrepaymentRule,
  Staff,
  Workplace,
} from '@/domain/core';
import { addMinutes } from '@/lib/date';
import { hasStarted, isActiveBooking, isOnlineSource } from '@/domain/rules/booking-status';
import { hasPrepayment } from '@/domain/rules/pricing';

export type EffectiveBookingRules = Required<BookingRules>;

export const DEFAULT_BOOKING_RULES: EffectiveBookingRules = {
  allowCancel: true,
  allowReschedule: true,
  cancelWindowMin: 180,
  rescheduleWindowMin: 180,
  allowCancelPrepaid: true,
  allowReschedulePrepaid: false,
  keepPrepaymentOnLateCancel: true,
};

/** Действующие правила: по умолчанию ← бизнес ← мастер (поля без значения не перетирают) */
export function effectiveBookingRules(
  business: Pick<Business, 'bookingRules'> | undefined,
  staff?: Pick<Staff, 'bookingRules'> | undefined,
): EffectiveBookingRules {
  const out: EffectiveBookingRules = { ...DEFAULT_BOOKING_RULES };
  for (const layer of [business?.bookingRules, staff?.bookingRules]) {
    if (!layer) continue;
    for (const key of Object.keys(layer) as (keyof BookingRules)[]) {
      const value = layer[key];
      if (value !== undefined) (out as Record<keyof BookingRules, unknown>)[key] = value;
    }
  }
  return out;
}

type PolicyBooking = Pick<Booking, 'start' | 'status' | 'deletedAt' | 'prepayment'>;

/** До какого момента отмена бесплатна */
export function freeCancelUntil(booking: Pick<Booking, 'start'>, rules: Pick<BookingRules, 'cancelWindowMin'>): ISODateTime {
  return addMinutes(booking.start, -(rules.cancelWindowMin ?? DEFAULT_BOOKING_RULES.cancelWindowMin));
}

/** До какого момента клиент может перенести сам */
export function rescheduleUntil(booking: Pick<Booking, 'start'>, rules: Pick<BookingRules, 'rescheduleWindowMin'>): ISODateTime {
  return addMinutes(booking.start, -(rules.rescheduleWindowMin ?? DEFAULT_BOOKING_RULES.rescheduleWindowMin));
}

/** Отмена сейчас ещё бесплатна (раньше срока) */
export function canCancelFree(booking: Pick<Booking, 'start'>, rules: Pick<BookingRules, 'cancelWindowMin'>, now: ISODateTime): boolean {
  return now < freeCancelUntil(booking, rules);
}

export type ClientActionDenied = 'not_active' | 'started' | 'not_allowed' | 'prepaid_locked' | 'too_late';

export type ClientCancelOutcome =
  | { allowed: false; reason: ClientActionDenied }
  | {
      allowed: true;
      status: 'cancelled_by_client';
      /** Позже срока бесплатной отмены — засчитать неявку */
      late: boolean;
      noShowIncrement: 0 | 1;
      /** До какого момента была бесплатна */
      freeUntil: ISODateTime;
      /** Сколько предоплаты вернуть клиенту (0 — нечего или остаётся мастеру) */
      refund: number;
      /** Полученная предоплата остаётся мастеру: поздняя отмена и так решил мастер (В-04) */
      prepaymentKept: number;
    };

/** Что будет, если клиент отменит запись сейчас (F-00-098, F-03-067) */
export function clientCancelOutcome(booking: PolicyBooking, rules: EffectiveBookingRules, now: ISODateTime): ClientCancelOutcome {
  if (!isActiveBooking(booking)) return { allowed: false, reason: 'not_active' };
  if (hasStarted(booking, now)) return { allowed: false, reason: 'started' };
  if (!rules.allowCancel) return { allowed: false, reason: 'not_allowed' };
  if (booking.prepayment?.paid && !rules.allowCancelPrepaid) return { allowed: false, reason: 'prepaid_locked' };
  const freeUntil = freeCancelUntil(booking, rules);
  const late = now >= freeUntil;
  const paid = booking.prepayment?.paid ? booking.prepayment.amount : 0;
  const keep = late && rules.keepPrepaymentOnLateCancel;
  return {
    allowed: true,
    status: 'cancelled_by_client',
    late,
    noShowIncrement: late ? 1 : 0,
    freeUntil,
    refund: keep ? 0 : paid,
    prepaymentKept: keep ? paid : 0,
  };
}

export type RescheduleCheck = { allowed: true; until: ISODateTime } | { allowed: false; reason: ClientActionDenied; until: ISODateTime };

/** Может ли клиент сам перенести запись сейчас (F-00-099, F-03-066): только до срока переноса */
export function canReschedule(booking: PolicyBooking, rules: EffectiveBookingRules, now: ISODateTime): RescheduleCheck {
  const until = rescheduleUntil(booking, rules);
  if (!isActiveBooking(booking)) return { allowed: false, reason: 'not_active', until };
  if (hasStarted(booking, now)) return { allowed: false, reason: 'started', until };
  if (!rules.allowReschedule) return { allowed: false, reason: 'not_allowed', until };
  if (booking.prepayment?.paid && !rules.allowReschedulePrepaid) return { allowed: false, reason: 'prepaid_locked', until };
  if (now >= until) return { allowed: false, reason: 'too_late', until };
  return { allowed: true, until };
}

// ─────────────────────────── Статус новой записи ───────────────────────────

export interface NewStatusInput {
  source: BookingSource;
  staff: Pick<Staff, 'confirmMode' | 'prepayment' | 'calendarVisibility'>;
  workplace: Workplace;
  /** Клиент — «свой» у мастера (для режима «Только мои клиенты», F-00-065); по умолчанию да */
  isOwnClient?: boolean;
  /** Предоплата уже внесена (перенос оплаченной записи) */
  prepaymentPaid?: boolean;
  /** ⭐ Сколько раз клиент не пришёл к этому мастеру за период правила (recentNoShows); нет — 0 */
  clientNoShows?: number;
}

/** Нужна ли клиенту предоплата при записи онлайн (F-00-097: по желанию мастера; ⭐ или только тем, кто не приходил) */
export function requiresPrepayment(input: Pick<NewStatusInput, 'source' | 'staff' | 'prepaymentPaid' | 'clientNoShows'>): boolean {
  return isOnlineSource(input.source) && !input.prepaymentPaid && prepaymentNeed(input.staff.prepayment, input.clientNoShows) !== undefined;
}

// ─────────────────────────── ⭐ Предоплата для тех, кто не приходил (владелец, 01.10.2026) ───────────────────────────

/** Порог по умолчанию: «не пришёл 2 раза за последние 12 месяцев» */
export const DEFAULT_NO_SHOW_PREPAYMENT: NoShowPrepaymentRule = { count: 2, months: 12 };
export const NO_SHOW_PREPAYMENT_LIMITS = { count: { min: 1, max: 10 }, months: { min: 1, max: 24 } } as const;

/** Порог в допустимых пределах (сервер и форма приводят одинаково) */
export function normalizeNoShowRule(rule: Partial<NoShowPrepaymentRule> | undefined): NoShowPrepaymentRule {
  const clamp = (v: number | undefined, d: number, lim: { min: number; max: number }) =>
    Math.min(lim.max, Math.max(lim.min, Math.round(Number.isFinite(v) ? (v as number) : d)));
  return {
    count: clamp(rule?.count, DEFAULT_NO_SHOW_PREPAYMENT.count, NO_SHOW_PREPAYMENT_LIMITS.count),
    months: clamp(rule?.months, DEFAULT_NO_SHOW_PREPAYMENT.months, NO_SHOW_PREPAYMENT_LIMITS.months),
  };
}

/** Засчитывается как «не пришёл»: статус «Не пришёл» или отмена клиентом позже срока (F-00-098) */
export function countsAsNoShow(b: Pick<Booking, 'status' | 'cancelledLate' | 'deletedAt'>): boolean {
  return !b.deletedAt && (b.status === 'no_show' || (b.status === 'cancelled_by_client' && Boolean(b.cancelledLate)));
}

/** Начало периода «последние M месяцев» от момента now */
export function noShowPeriodStart(now: ISODateTime, months: number): ISODateTime {
  const y = +now.slice(0, 4);
  const m = +now.slice(5, 7) - 1 - months;
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(+now.slice(8, 10), lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}${now.slice(10)}`;
}

/**
 * Сколько раз клиент не пришёл именно к ЭТОМУ мастеру за последние `months` месяцев (В-07: у каждого мастера свой
 * счётчик, чужие мастера и салоны не считаются). Клиент — карточка бизнеса (clientId) или пользователь приложения.
 */
export function recentNoShows(
  bookings: readonly Pick<Booking, 'staffId' | 'clientId' | 'appUserId' | 'start' | 'status' | 'cancelledLate' | 'deletedAt'>[],
  q: { staffId: Id; clientId?: Id; appUserId?: Id; now: ISODateTime; months: number },
): number {
  if (!q.clientId && !q.appUserId) return 0;
  const from = noShowPeriodStart(q.now, q.months);
  return bookings.filter(
    (b) =>
      b.staffId === q.staffId &&
      ((q.clientId && b.clientId === q.clientId) || (q.appUserId && b.appUserId === q.appUserId)) &&
      b.start >= from &&
      b.start <= q.now &&
      countsAsNoShow(b),
  ).length;
}

export type PrepaymentNeed = { reason: 'all' } | { reason: 'no_shows'; noShows: number; count: number; months: number };

/**
 * Нужна ли предоплата этому клиенту по правилу мастера: всем — `{ reason: 'all' }`; только тем, кто не приходил, —
 * `{ reason: 'no_shows', … }`, если `clientNoShows` ≥ порога; иначе undefined. Онлайн-источник проверяет вызывающий.
 */
export function prepaymentNeed(
  rule: Pick<PrepaymentRule, 'amount' | 'percent' | 'onlyAfterNoShows'> | undefined,
  clientNoShows = 0,
): PrepaymentNeed | undefined {
  if (!rule || !hasPrepayment(rule)) return undefined;
  if (!rule.onlyAfterNoShows) return { reason: 'all' };
  const { count, months } = normalizeNoShowRule(rule.onlyAfterNoShows);
  return clientNoShows >= count ? { reason: 'no_shows', noShows: clientNoShows, count, months } : undefined;
}

/** Начальный статус записи — одно правило для приложения, виджета и журнала */
export function newBookingStatus(input: NewStatusInput): BookingStatus {
  if (!isOnlineSource(input.source)) return 'scheduled';
  // Выезд — всегда с подтверждением мастера, не отключается (F-00-079)
  if (input.workplace === 'visit') return 'awaiting_confirmation';
  if (requiresPrepayment(input)) return 'awaiting_prepayment';
  if (input.staff.calendarVisibility === 'mine' && input.isOwnClient === false) return 'awaiting_confirmation';
  if (input.staff.confirmMode === 'manual') return 'awaiting_confirmation';
  return 'scheduled';
}

/** Статус после переноса клиентом: то же правило, оплаченная предоплата не требуется повторно */
export function rescheduledStatus(booking: Pick<Booking, 'source' | 'workplace' | 'prepayment'>, staff: NewStatusInput['staff']): BookingStatus {
  return newBookingStatus({
    source: isOnlineSource(booking.source) ? booking.source : 'app',
    staff,
    workplace: booking.workplace,
    prepaymentPaid: booking.prepayment?.paid ?? false,
    // ⭐ Предоплата «за то, что не приходил» не снимается переносом: порог считали при записи
    clientNoShows: booking.prepayment?.reason === 'no_shows' ? Number.MAX_SAFE_INTEGER : 0,
  });
}

// ─────────────────────────── Можно ли записаться онлайн ───────────────────────────

export type OnlineBookingDenied =
  | 'business_inactive'
  | 'staff_unavailable'
  | 'online_disabled'
  | 'online_paused'
  | 'staff_on_vacation'
  | 'client_blocked'
  | 'accepts_mismatch';

export interface CanBookOnlineInput {
  business: Pick<Business, 'status'>;
  staff: Pick<Staff, 'status' | 'onlineBookingEnabled' | 'accepts'>;
  /** Карточка клиента в этом бизнесе, если есть (Client.blocked — F-03-135) */
  client?: Pick<Client, 'blocked' | 'gender'>;
  appUser?: Pick<AppUser, 'gender'>;
  /** Дата записи 'YYYY-MM-DD' */
  date: ISODate;
  /** «Онлайн-запись приостановлена до» всей локации (F-03-142; срез online) */
  pauseUntil?: ISODate;
  /** «В отпуске до» мастера (F-03-142; срез online) */
  vacationUntil?: ISODate;
}

/** Проверки записи клиентом онлайн до расчёта окна; undefined — можно */
export function canBookOnline(input: CanBookOnlineInput): OnlineBookingDenied | undefined {
  if (input.business.status !== 'active') return 'business_inactive';
  if (input.staff.status !== 'active') return 'staff_unavailable';
  if (input.staff.onlineBookingEnabled === false) return 'online_disabled';
  if (input.pauseUntil && input.pauseUntil >= input.date) return 'online_paused';
  if (input.vacationUntil && input.vacationUntil >= input.date) return 'staff_on_vacation';
  if (input.client?.blocked) return 'client_blocked';
  // «Кого принимаю» (F-00-069): проверяем, только если пол известен
  const gender = input.client?.gender && input.client.gender !== 'unknown' ? input.client.gender : input.appUser?.gender;
  if (input.staff.accepts === 'women' && gender === 'male') return 'accepts_mismatch';
  if (input.staff.accepts === 'men' && gender === 'female') return 'accepts_mismatch';
  return undefined;
}

// ─────────────────────────── Предоплата, отмена мастером ───────────────────────────

/** Неоплаченная предоплата просрочена — окно освобождается само (F-00-097) */
export function isPrepaymentExpired(booking: Pick<Booking, 'status' | 'prepayment' | 'deletedAt'>, now: ISODateTime): boolean {
  return (
    !booking.deletedAt &&
    booking.status === 'awaiting_prepayment' &&
    !booking.prepayment?.paid &&
    Boolean(booking.prepayment?.holdUntil) &&
    now >= (booking.prepayment?.holdUntil ?? '')
  );
}

/** Отмена мастером: внесённая предоплата возвращается полностью (F-00-100) — сумма к возврату */
export function masterCancelRefund(booking: Pick<Booking, 'prepayment'>): number {
  return booking.prepayment?.paid ? booking.prepayment.amount : 0;
}

/** Сколько минут до начала (отрицательное — уже началась) */
export function minutesUntilStart(booking: Pick<Booking, 'start'>, now: ISODateTime): Minutes {
  const [d1, t1] = [now.slice(0, 10), now.slice(11, 16)];
  const [d2, t2] = [booking.start.slice(0, 10), booking.start.slice(11, 16)];
  const dayMs = Date.UTC(+d2.slice(0, 4), +d2.slice(5, 7) - 1, +d2.slice(8, 10)) - Date.UTC(+d1.slice(0, 4), +d1.slice(5, 7) - 1, +d1.slice(8, 10));
  const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  return dayMs / 60_000 + toMin(t2) - toMin(t1);
}

/**
 * В-03: срок ответа мастера на заявку — от сервера (Booking.confirmDeadline), иначе min(создание + 2 ч, начало − 1 ч).
 * Молчание до срока → заявка снимается (confirmation_expired), клиенту — 3 ближайших окна (nearestFreeStarts).
 */
export function confirmDeadlineOf(b: Pick<Booking, 'confirmDeadline' | 'createdAt' | 'start'>): ISODateTime {
  if (b.confirmDeadline) return b.confirmDeadline;
  const byWait = addMinutes(b.createdAt, 120);
  const byStart = addMinutes(b.start, -60);
  return byWait < byStart ? byWait : byStart;
}
