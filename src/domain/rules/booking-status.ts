/**
 * СТАТУСЫ ЗАПИСИ — единый источник правды (F-00-068, F-01-027, arch-a1 №2).
 * Чистые функции: без React, без стора, без 'use client' — переносятся на сервер как есть.
 *
 * Своих списков «отменённых/активных» статусов в разделах не заводите (сторож A16) — берите отсюда.
 * Подписи — common.bookingStatus.<status> (кабинет) или словарь client (от лица клиента); тон бейджа — bookingStatusTone().
 */
import type { Booking, BookingSource, BookingStatus, ISODateTime } from '@/domain/core';
import { addMinutes } from '@/lib/date';

/** Все статусы в порядке жизни записи */
export const BOOKING_STATUSES: readonly BookingStatus[] = [
  'awaiting_confirmation',
  'awaiting_prepayment',
  'scheduled',
  'client_confirmed',
  'arrived',
  'no_show',
  'cancelled_by_client',
  'cancelled_by_master',
];

/** Ждут действия (мастера — подтвердить, клиента — оплатить) */
export const PENDING_STATUSES: readonly BookingStatus[] = ['awaiting_confirmation', 'awaiting_prepayment'];

/** Отменённые: время свободно, в отчётах «отмена» */
export const CANCELLED_STATUSES: readonly BookingStatus[] = ['cancelled_by_client', 'cancelled_by_master'];

/** Визит ещё впереди (не итоговый статус): ждёт подтверждения/предоплаты, записан, клиент подтвердил */
export const ACTIVE_STATUSES: readonly BookingStatus[] = [
  'awaiting_confirmation',
  'awaiting_prepayment',
  'scheduled',
  'client_confirmed',
];

/** Подтверждённая запись (F-00-077: после неё клиенту виден домашний адрес мастера) */
export const CONFIRMED_STATUSES: readonly BookingStatus[] = ['scheduled', 'client_confirmed', 'arrived'];

/** Итоговые: визит состоялся, не состоялся или отменён */
export const FINAL_STATUSES: readonly BookingStatus[] = ['arrived', 'no_show', 'cancelled_by_client', 'cancelled_by_master'];

/** Занимают время мастера/ресурса — всё, кроме отменённых (и удалённых) */
export const BUSY_STATUSES: readonly BookingStatus[] = BOOKING_STATUSES.filter((s) => !CANCELLED_STATUSES.includes(s));

type StatusOf = BookingStatus | Pick<Booking, 'status'>;
const statusOf = (x: StatusOf): BookingStatus => (typeof x === 'string' ? x : x.status);

export function isCancelled(x: StatusOf): boolean {
  return CANCELLED_STATUSES.includes(statusOf(x));
}

export function isPending(x: StatusOf): boolean {
  return PENDING_STATUSES.includes(statusOf(x));
}

export function isFinal(x: StatusOf): boolean {
  return FINAL_STATUSES.includes(statusOf(x));
}

export function isConfirmed(x: StatusOf): boolean {
  return CONFIRMED_STATUSES.includes(statusOf(x));
}

/** Запись «живая»: не удалена и визит ещё впереди по статусу */
export function isActiveBooking(b: Pick<Booking, 'status' | 'deletedAt'>): boolean {
  return !b.deletedAt && ACTIVE_STATUSES.includes(b.status);
}

/** Запись держит время мастера (для окон, пересечений, загрузки) */
export function occupiesTime(b: Pick<Booking, 'status' | 'deletedAt'>): boolean {
  return !b.deletedAt && !isCancelled(b.status);
}

/** Конец записи 'YYYY-MM-DDTHH:mm' */
export function bookingEnd(b: Pick<Booking, 'start' | 'durationMin'>): ISODateTime {
  return addMinutes(b.start, b.durationMin);
}

/** Предстоящая: активна и ещё не закончилась к now */
export function isUpcoming(b: Pick<Booking, 'status' | 'deletedAt' | 'start' | 'durationMin'>, now: ISODateTime): boolean {
  return isActiveBooking(b) && bookingEnd(b) > now;
}

/** Уже началась к now */
export function hasStarted(b: Pick<Booking, 'start'>, now: ISODateTime): boolean {
  return b.start <= now;
}

/**
 * Три списка «Мои записи» клиента (F-14-011): предстоящие (ближайшая первой), прошедшие (свежая первой), отменённые.
 * Прошедшая = не отменена и закончилась (или итоговый статус «пришёл/не пришёл»).
 */
export function splitClientBookings<B extends Pick<Booking, 'status' | 'deletedAt' | 'start' | 'durationMin'>>(
  list: readonly B[],
  now: ISODateTime,
): { upcoming: B[]; past: B[]; cancelled: B[] } {
  const alive = list.filter((b) => !b.deletedAt);
  const cancelled = alive.filter((b) => isCancelled(b)).sort((a, b) => b.start.localeCompare(a.start));
  const rest = alive.filter((b) => !isCancelled(b));
  const upcoming = rest.filter((b) => isUpcoming(b, now)).sort((a, b) => a.start.localeCompare(b.start));
  const past = rest.filter((b) => !isUpcoming(b, now)).sort((a, b) => b.start.localeCompare(a.start));
  return { upcoming, past, cancelled };
}

/** Онлайн-источник: клиент записался сам (приложение, ссылка, виджет) — F-00-093, шапка блока F-01-027 */
export function isOnlineSource(source: BookingSource): boolean {
  return source === 'app' || source === 'link' || source === 'widget';
}

// ─────────────────────────── Вид статуса (тон и значок) ───────────────────────────

/** Тоны — те же имена, что BadgeTone в src/ui/Badge (цвета — токены темы) */
export type StatusTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
/** Имя значка lucide в kebab-case (домен не импортирует React): clock → <Clock/> */
export type StatusIconName = 'clock' | 'wallet' | 'check-circle' | 'plus-circle' | 'minus-circle' | 'x-circle';
/** Кто смотрит: кабинет бизнеса или клиент (у клиента «отменил мастер» — плохая новость, тон danger) */
export type StatusAudience = 'business' | 'client';

export interface BookingStatusMeta {
  tone: StatusTone;
  icon: StatusIconName;
  /** Ключ подписи в кабинете: t = useT('common'); t(meta.labelKey) */
  labelKey: `bookingStatus.${BookingStatus}`;
}

export const BOOKING_STATUS_META: Record<BookingStatus, BookingStatusMeta> = {
  awaiting_confirmation: { tone: 'info', icon: 'clock', labelKey: 'bookingStatus.awaiting_confirmation' },
  awaiting_prepayment: { tone: 'warning', icon: 'wallet', labelKey: 'bookingStatus.awaiting_prepayment' },
  scheduled: { tone: 'primary', icon: 'clock', labelKey: 'bookingStatus.scheduled' },
  client_confirmed: { tone: 'accent', icon: 'check-circle', labelKey: 'bookingStatus.client_confirmed' },
  arrived: { tone: 'success', icon: 'plus-circle', labelKey: 'bookingStatus.arrived' },
  no_show: { tone: 'danger', icon: 'minus-circle', labelKey: 'bookingStatus.no_show' },
  cancelled_by_client: { tone: 'neutral', icon: 'x-circle', labelKey: 'bookingStatus.cancelled_by_client' },
  cancelled_by_master: { tone: 'neutral', icon: 'x-circle', labelKey: 'bookingStatus.cancelled_by_master' },
};

/** Тон бейджа статуса. Клиенту отмена мастером и неявка — danger, своя отмена — neutral */
export function bookingStatusTone(status: BookingStatus, audience: StatusAudience = 'business'): StatusTone {
  if (audience === 'client' && status === 'cancelled_by_master') return 'danger';
  return BOOKING_STATUS_META[status].tone;
}

// ─────────────────────────── Переходы ───────────────────────────

/** Кто меняет статус: сотрудник в кабинете, клиент (приложение/ссылка), система (истёк срок) */
export type StatusActor = 'business' | 'client' | 'system';

const CLIENT_TRANSITIONS: Partial<Record<BookingStatus, readonly BookingStatus[]>> = {
  awaiting_confirmation: ['cancelled_by_client'],
  awaiting_prepayment: ['cancelled_by_client'],
  // «Подтверждаю, что приду» (F-14-057)
  scheduled: ['client_confirmed', 'cancelled_by_client'],
  client_confirmed: ['cancelled_by_client'],
};

const SYSTEM_TRANSITIONS: Partial<Record<BookingStatus, readonly BookingStatus[]>> = {
  // Не оплатил вовремя — окно освобождается само (F-00-097)
  awaiting_prepayment: ['cancelled_by_client'],
};

/**
 * Можно ли перевести запись из from в to.
 *  - сотрудник: любой статус в любой (как в журнале Altegio: статус можно вернуть), кроме «ждёт предоплату» —
 *    его ставит только создание записи у мастера с предоплатой;
 *  - клиент: подтвердить визит и отменить свою активную запись;
 *  - система: снять неоплаченную запись по истечении срока.
 */
export function canTransition(from: BookingStatus, to: BookingStatus, actor: StatusActor): boolean {
  if (from === to) return false;
  if (actor === 'business') return to !== 'awaiting_prepayment';
  const map = actor === 'client' ? CLIENT_TRANSITIONS : SYSTEM_TRANSITIONS;
  return map[from]?.includes(to) ?? false;
}

/** Статусы, в которые actor может перевести запись (для кнопок/меню) */
export function nextStatuses(from: BookingStatus, actor: StatusActor): BookingStatus[] {
  return BOOKING_STATUSES.filter((to) => canTransition(from, to, actor));
}

/**
 * Изменение счётчика неявок клиента при смене статуса (F-00-071): вошли в «не пришёл» → +1, вышли → −1.
 * Отмена позже срока — отдельно, clientCancelOutcome().noShowIncrement (rules/booking-policy).
 */
export function noShowDelta(from: BookingStatus, to: BookingStatus): -1 | 0 | 1 {
  if (from !== 'no_show' && to === 'no_show') return 1;
  if (from === 'no_show' && to !== 'no_show') return -1;
  return 0;
}
