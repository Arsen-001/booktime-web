'use client';

/**
 * ⭐ Рабочий день журнала (владелец, 01.10.2026 — пункты 5, 6, 7): утренняя сводка, незакрытые визиты, итоги дня.
 * Только чтение: визит закрывают те же команды, что и журнал (changeBookingStatus, instantPayBooking — деньги идут в
 * кассу), смену и Z-отчёт ведёт кассовая смена финансов (listCashShifts / closeCashShift). Режим api — сервер
 * (booktime-backend src/modules/workday), мок — по базе браузера тем же правилам (src/domain/journalWorkday.ts).
 * Мастер без права journal.others видит только свои записи.
 */
import { readArea, readCore } from '@/api/area';
import { canNow, currentActor } from '@/api/core';
import { bookingPaymentBriefSync } from '@/api/finance';
import { isApiMode } from '@/api/http';
import * as S from '@/api/journal-workday.server';
import { request } from '@/api/request';
import type { Booking, Client, ISODate, Id } from '@/domain/core';
import {
  BEFORE_ARRIVAL_STATUSES,
  DEBT_DAYS,
  PREPAYMENT_AHEAD_DAYS,
  UNCLOSED_DAYS,
  ageOn,
  dayMoneyOf,
  isBirthdayOn,
  isClosableVisit,
  unclosedReason,
  type DayCloseSummary,
  type DayMoney,
  type MorningSummary,
  type UnclosedVisit,
  type WorkdayItem,
} from '@/domain/journalWorkday';
import { CANCELLED_STATUSES } from '@/domain/rules';
import { addDays, nowDateTime } from '@/lib/date';

export type { DayCloseSummary, MorningSummary, UnclosedVisit, WorkdayItem } from '@/domain/journalWorkday';

/** Ключи запросов раздела — один ключ = одна функция чтения */
export const workdayKeys = {
  morning: (businessId: Id, date: ISODate) => ['journal', 'workday', 'morning', businessId, date] as const,
  unclosed: (businessId: Id) => ['journal', 'workday', 'unclosed', businessId] as const,
  dayClose: (businessId: Id, date: ISODate) => ['journal', 'workday', 'day-close', businessId, date] as const,
};

// ─────────── мок: общее ───────────

/** Мастер без journal.others — только свои записи */
function ownStaffSync(): Id | undefined {
  return canNow('journal.others') ? undefined : currentActor().staffId;
}

function clientName(c: Client | undefined, b?: Booking): string | undefined {
  return c?.name.trim() || b?.visitorName || undefined;
}

function itemOf(b: Booking, clients: Map<Id, Client>): WorkdayItem {
  const reportedAt = readArea('online').bookingMeta[b.id]?.prepaymentReportedAt ?? b.prepayment?.clientMarkedPaidAt;
  return {
    bookingId: b.id,
    start: b.start,
    durationMin: b.durationMin,
    staffId: b.staffId,
    ...(b.clientId ? { clientId: b.clientId } : {}),
    clientName: clientName(b.clientId ? clients.get(b.clientId) : undefined, b),
    serviceIds: b.services.map((l) => l.serviceId),
    total: b.total,
    status: b.status,
    ...(reportedAt && b.prepayment && !b.prepayment.paid ? { reported: true } : {}),
  };
}

function bizBookingsSync(businessId: Id, staffId: Id | undefined): Booking[] {
  return readCore().bookings.filter((b) => b.businessId === businessId && !b.deletedAt && !b.groupEventId && (!staffId || b.staffId === staffId));
}

function clientsMapSync(businessId: Id): Map<Id, Client> {
  return new Map(readCore().clients.filter((c) => c.businessId === businessId).map((c) => [c.id, c]));
}

/** Незакрытые визиты по уже прочитанной базе: с from (дата) по «сейчас», новые сверху */
function unclosedSync(businessId: Id, staffId: Id | undefined, from: ISODate, to?: ISODate): UnclosedVisit[] {
  const now = nowDateTime();
  const clients = clientsMapSync(businessId);
  const out: UnclosedVisit[] = [];
  for (const b of bizBookingsSync(businessId, staffId)) {
    if (b.start.slice(0, 10) < from || (to && b.start.slice(0, 10) > to) || b.start > now) continue;
    if (!isClosableVisit(b)) continue;
    if (b.status !== 'arrived' && !BEFORE_ARRIVAL_STATUSES.includes(b.status)) continue;
    // Остаток — и у тех, кто ещё без отметки: после «Пришёл» строка сразу знает, сколько осталось оплатить
    const brief = bookingPaymentBriefSync(businessId, b);
    const reason = unclosedReason(b, brief.due, now);
    if (!reason) continue;
    const { total, due } = brief;
    out.push({ booking: b, clientName: clientName(b.clientId ? clients.get(b.clientId) : undefined, b), total, paid: Math.max(0, total - due), due, reason });
  }
  return out.sort((a, b) => b.booking.start.localeCompare(a.booking.start));
}

// ─────────── Незакрытые визиты (пункт 6) ───────────

/** Прошедшие записи без «Пришёл»/«Не пришёл» и визиты «Пришёл» с остатком за UNCLOSED_DAYS дней */
export function listUnclosedVisits(businessId: Id): Promise<UnclosedVisit[]> {
  if (isApiMode()) return S.unclosed(businessId);
  return request(() => unclosedSync(businessId, ownStaffSync(), addDays(nowDateTime().slice(0, 10), -UNCLOSED_DAYS)), { permission: 'journal.view' });
}

// ─────────── Утренняя сводка (пункт 5) ───────────

export function getMorningSummary(businessId: Id, date: ISODate): Promise<MorningSummary> {
  if (isApiMode()) return S.morning(businessId, date);
  return request(
    () => {
      const staffId = ownStaffSync();
      const clients = clientsMapSync(businessId);
      const all = bizBookingsSync(businessId, staffId);
      const item = (b: Booking) => itemOf(b, clients);
      const byStart = (a: Booking, b: Booking) => a.start.localeCompare(b.start);
      const active = all.filter((b) => b.start.startsWith(date) && !CANCELLED_STATUSES.includes(b.status)).sort(byStart);
      const until = addDays(date, PREPAYMENT_AHEAD_DAYS);
      const prepayments = all.filter((b) => b.status === 'awaiting_prepayment' && b.start.slice(0, 10) >= date && b.start.slice(0, 10) < until).sort(byStart);
      // Новые клиенты: до этого дня ни одного визита «Пришёл»
      const returning = new Set(all.filter((b) => b.status === 'arrived' && b.start.slice(0, 10) < date && b.clientId).map((b) => b.clientId));
      // Дни рождения: все клиенты бизнеса (мастеру — те, кто у него бывал)
      const mine = staffId ? new Set(all.map((b) => b.clientId)) : undefined;
      const bookingOf = new Map(active.filter((b) => b.clientId).map((b) => [b.clientId as Id, b]));
      const birthdays = [...clients.values()]
        .filter((c) => !c.deletedAt && isBirthdayOn(c.birthday, date) && (!mine || mine.has(c.id)))
        .map((c) => {
          const b = bookingOf.get(c.id);
          const age = ageOn(c.birthday!, date);
          return { clientId: c.id, name: clientName(c) ?? c.name, birthday: c.birthday!, ...(age ? { age } : {}), ...(b ? { bookingId: b.id, start: b.start } : {}) };
        });
      // Долги: визиты «Пришёл» за год, оплаченные не полностью
      const debtFrom = addDays(date, -DEBT_DAYS);
      const debtBy = new Map<Id, { amount: number; visits: number; lastVisit: ISODate }>();
      for (const b of all) {
        const day = b.start.slice(0, 10);
        if (b.status !== 'arrived' || !b.clientId || day < debtFrom || day > date) continue;
        const due = bookingPaymentBriefSync(businessId, b).due;
        if (due <= 0) continue;
        const d = debtBy.get(b.clientId) ?? { amount: 0, visits: 0, lastVisit: day };
        d.amount += due;
        d.visits += 1;
        if (day > d.lastVisit) d.lastVisit = day;
        debtBy.set(b.clientId, d);
      }
      const today = nowDateTime().slice(0, 10);
      const unclosedCount = unclosedSync(businessId, staffId, addDays(today, -UNCLOSED_DAYS), addDays(date <= today ? date : today, -1)).length;
      return {
        date,
        bookings: active.map(item),
        notConfirmed: active.filter((b) => b.status === 'scheduled' && b.clientId).map(item),
        requests: active.filter((b) => b.status === 'awaiting_confirmation').map(item),
        newClients: active.filter((b) => b.clientId && !returning.has(b.clientId)).map(item),
        birthdays,
        prepayments: prepayments.map(item),
        debts: [...debtBy.entries()]
          .map(([clientId, d]) => ({ clientId, name: clientName(clients.get(clientId)) ?? '', ...d }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 50),
        debtTotal: { clients: debtBy.size, amount: [...debtBy.values()].reduce((sum, d) => sum + d.amount, 0) },
        unclosedCount,
      };
    },
    { permission: 'journal.stats' },
  );
}

// ─────────── Итоги дня (пункт 7) ───────────

/** Деньги кассы за день по уже прочитанной базе (итоги дня и уведомление владельцу о закрытии дня) */
export function dayMoneySync(businessId: Id, date: ISODate): DayMoney {
  const fin = readArea('finance');
  return dayMoneyOf(fin.operations, {
    date,
    accountIds: new Set(fin.accounts.filter((a) => a.businessId === businessId).map((a) => a.id)),
    refundItemId: fin.itemBySystemKey[businessId]?.refund,
    adjustmentIds: new Set((fin.cashShifts ?? []).flatMap((sh) => sh.adjustmentOperationIds ?? [])),
  });
}

export function getDayClose(businessId: Id, date: ISODate): Promise<DayCloseSummary> {
  if (isApiMode()) return S.dayClose(businessId, date);
  return request(
    () => {
      const staffId = ownStaffSync();
      const clients = clientsMapSync(businessId);
      const day = bizBookingsSync(businessId, staffId)
        .filter((b) => b.start.startsWith(date))
        .sort((a, b) => a.start.localeCompare(b.start));
      const item = (b: Booking) => itemOf(b, clients);
      const active = day.filter((b) => !CANCELLED_STATUSES.includes(b.status));
      const arrived = day.filter((b) => b.status === 'arrived');
      const noShows = day.filter((b) => b.status === 'no_show');
      const cancelled = day.filter((b) => CANCELLED_STATUSES.includes(b.status));
      // Деньги кассы за день — операции всех касс бизнеса датой этого дня (как «Касса за день»); мастеру — нет
      const money: DayMoney = staffId ? { cash: 0, card: 0, transfer: 0, other: 0, refunds: 0, expense: 0 } : dayMoneySync(businessId, date);
      const sum = (xs: Booking[]) => xs.reduce((s, b) => s + b.total, 0);
      return {
        date,
        counts: {
          bookings: active.length,
          arrived: arrived.length,
          noShow: noShows.length,
          cancelled: cancelled.length,
          unclosed: unclosedSync(businessId, staffId, date, date).length,
        },
        revenue: { booked: sum(active), done: sum(arrived) },
        money: {
          cash: money.cash,
          card: money.card,
          transfer: money.transfer,
          other: money.other,
          totalIn: money.cash + money.card + money.transfer + money.other,
          refunds: money.refunds,
          expense: money.expense,
        },
        noShows: noShows.map(item),
        cancellations: cancelled.map(item),
      };
    },
    { permission: 'journal.stats' },
  );
}
