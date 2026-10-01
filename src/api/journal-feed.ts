'use client';

/**
 * «Лента изменений за день» журнала (⭐ рабочий день №12, 01.10.2026). Раздел journal.
 *
 * Кто, что и когда изменил в журнале за выбранный день: новая запись, перенос (время или мастер), смена статуса, отмена,
 * удаление, «мастер задерживается», оплата и отмена оплаты. Своих «событий» не заводим — лента собирается из того,
 * что уже пишут хозяева:
 *   · журнал событий записей ядра (listBookingEvents: created / status / moved / deleted / delayed, кто и когда);
 *   · записи ядра, созданные в этот день, у которых события «создана» нет (сид и старые данные) — по Booking.createdAt;
 *   · строки оплат визита раздела finance (bookingPayments: createdAt / createdBy, cancelledAt) — один платёж = одна строка.
 * Режим api — сервер собирает то же одной выборкой: GET /v1/biz/{b}/journal/day-feed?date= (booking_events +
 * booking_payments, имена сотрудников и клиентов уже подставлены).
 *
 * Права: кто не видит чужие записи (нет journal.others), получает только строки своих записей — и мок, и сервер.
 * Лента «Отчёты → Лента активности» — это другое: онлайн-записи с подтверждением, а не все правки журнала за день.
 */
import { readArea, readCore } from '@/api/area';
import { canNow, currentActor } from '@/api/core';
import { http, isApiMode } from '@/api/http';
import { request, trackRead } from '@/api/request';
import type { BookingStatus, ISODate, ISODateTime, Id, Money } from '@/domain/core';
import { paymentGroupKey } from '@/domain/finance';
import { isCancelled } from '@/domain/rules';

export type DayFeedKind = 'created' | 'moved' | 'status' | 'cancelled' | 'deleted' | 'delayed' | 'payment' | 'paymentCancelled';

export interface DayFeedItem {
  id: string;
  kind: DayFeedKind;
  /** Когда изменили (Ереван, 'YYYY-MM-DDTHH:mm') */
  at: ISODateTime;
  bookingId: Id;
  businessId: Id;
  staffId: Id;
  staffName?: string;
  /** Перенос к другому мастеру — прежний мастер */
  prevStaffId?: Id;
  prevStaffName?: string;
  clientName?: string;
  /** Время визита после изменения */
  start?: ISODateTime;
  /** Прежнее время визита (перенос) */
  prevStart?: ISODateTime;
  from?: BookingStatus;
  to?: BookingStatus;
  /** Отмена клиентом позже срока */
  late?: boolean;
  amount?: Money;
  method?: string;
  delayMin?: number;
  /** id сотрудника, 'client' (клиент онлайн) или 'system' (автоматически) */
  by: Id | 'client' | 'system';
  byName?: string;
}

export interface DayFeedQuery {
  businessIds: Id[];
  date: ISODate;
  /** Только записи этого мастера (у кого нет права видеть чужие) */
  onlyStaffId?: Id;
}

const MAX_ITEMS = 500;

export function listDayFeed(q: DayFeedQuery): Promise<DayFeedItem[]> {
  if (isApiMode()) {
    // Перечитывается вместе с записями: живые изменения (SSE) обновляют зеркало записей — и ленту
    trackRead('core.bookings');
    const [businessId, ...others] = q.businessIds;
    if (!businessId) return Promise.resolve([]);
    return http<DayFeedItem[]>('GET', `/v1/biz/${businessId}/journal/day-feed`, undefined, {
      query: { date: q.date, businessIds: others.join(',') || undefined, staffId: q.onlyStaffId },
    });
  }
  return request(() => buildMockFeed(q));
}

function buildMockFeed(q: DayFeedQuery): DayFeedItem[] {
  const core = readCore();
  const ids = new Set(q.businessIds);
  // Сервер решает за экран: без права видеть чужие — только свои записи, что бы экран ни попросил
  const own = canNow('journal.others') ? q.onlyStaffId : (currentActor().staffId ?? q.onlyStaffId ?? '');
  const onDay = (at?: string) => Boolean(at && at.slice(0, 10) === q.date);
  const staffName = new Map(core.staff.map((s) => [s.id, s.name]));
  const clientName = new Map(core.clients.map((c) => [c.id, c.name]));
  const bookings = new Map(core.bookings.map((b) => [b.id, b]));
  const nameOfBy = (by: string) => (by === 'client' || by === 'system' ? undefined : staffName.get(by));
  const mine = (staffId: Id, prevStaffId?: Id) => !own || staffId === own || prevStaffId === own;
  const out: DayFeedItem[] = [];

  const events = (core.bookingEvents ?? []).filter((e) => ids.has(e.businessId) && onDay(e.at));
  const withCreated = new Set(events.filter((e) => e.kind === 'created').map((e) => e.bookingId));
  for (const e of events) {
    if (!mine(e.staffId, e.prevStaffId)) continue;
    const b = bookings.get(e.bookingId);
    const kind: DayFeedKind = e.kind === 'status' && e.to && isCancelled(e.to) ? 'cancelled' : e.kind;
    out.push({
      id: e.id,
      kind,
      at: e.at,
      bookingId: e.bookingId,
      businessId: e.businessId,
      staffId: e.staffId,
      staffName: staffName.get(e.staffId),
      ...(e.prevStaffId && e.prevStaffId !== e.staffId ? { prevStaffId: e.prevStaffId, prevStaffName: staffName.get(e.prevStaffId) } : {}),
      clientName: (e.clientId ? clientName.get(e.clientId) : undefined) ?? b?.visitorName,
      start: e.start ?? b?.start,
      ...(e.kind === 'moved' && e.prevStart ? { prevStart: e.prevStart } : {}),
      ...(e.from ? { from: e.from } : {}),
      ...(e.to ? { to: e.to } : {}),
      ...(e.late ? { late: true } : {}),
      ...(e.delayMin ? { delayMin: e.delayMin } : {}),
      by: e.by,
      byName: nameOfBy(e.by),
    });
  }
  // Записи, созданные в этот день без события «создана» (сид, данные до журнала событий)
  for (const b of core.bookings) {
    if (!ids.has(b.businessId) || !onDay(b.createdAt) || withCreated.has(b.id) || !mine(b.staffId)) continue;
    out.push({
      id: `created:${b.id}`,
      kind: 'created',
      at: b.createdAt,
      bookingId: b.id,
      businessId: b.businessId,
      staffId: b.staffId,
      staffName: staffName.get(b.staffId),
      clientName: (b.clientId ? clientName.get(b.clientId) : undefined) ?? b.visitorName,
      start: b.start,
      to: b.status,
      by: b.createdBy,
      byName: nameOfBy(b.createdBy),
    });
  }
  // Оплаты визита (finance): строки одного нажатия «Оплатить» — одна строка ленты; скидки — не деньги
  const payments = new Map<string, DayFeedItem>();
  for (const line of readArea('finance').bookingPayments) {
    if (!ids.has(line.businessId) || line.kind === 'discount') continue;
    const b = bookings.get(line.bookingId);
    if (!b || !mine(b.staffId)) continue;
    const key = paymentGroupKey(line);
    const add = (kind: 'payment' | 'paymentCancelled', at: ISODateTime) => {
      const id = `${kind}:${key}`;
      const prev = payments.get(id);
      if (prev) {
        prev.amount = (prev.amount ?? 0) + line.amount;
        return;
      }
      payments.set(id, {
        id,
        kind,
        at,
        bookingId: b.id,
        businessId: b.businessId,
        staffId: b.staffId,
        staffName: staffName.get(b.staffId),
        clientName: (b.clientId ? clientName.get(b.clientId) : undefined) ?? b.visitorName,
        start: b.start,
        amount: line.amount,
        method: line.methodLabel,
        by: line.createdBy || 'system',
        byName: nameOfBy(line.createdBy),
      });
    };
    if (onDay(line.createdAt)) add('payment', line.createdAt);
    if (line.cancelled && line.cancelledAt && onDay(line.cancelledAt)) add('paymentCancelled', line.cancelledAt);
  }
  out.push(...payments.values());
  return out.sort((a, b) => (a.at === b.at ? b.id.localeCompare(a.id) : b.at.localeCompare(a.at))).slice(0, MAX_ITEMS);
}
