/**
 * Деньги клиента — одно правило для строки списка, карточки, истории визитов и окна записи
 * (ux-r5 №1, recheck-c2 №1, e2e-q3 №1: раньше карточка писала «Оплачено 0 · Долг 10 000», а история того же визита —
 * «Оплачено 10 000 из 10 000»).
 *
 * Пока раздел finance не разносит платежи по визитам, визит «Пришёл» без отдельной записи об оплате считается
 * оплаченным полностью; долг — только там, где оплату внесли явно и не всю («Добавить визит» с частичной суммой).
 * Когда finance даст оплаты по записи — меняется только `visitPaid`, экраны не трогаются.
 */
import type { BookingStatus, Id, Money } from '@/domain/core';

/** Визит = группа записей одного прихода (visitId) или одна запись */
export interface MoneyBooking {
  id: Id;
  visitId?: Id;
  status: BookingStatus;
  total: Money;
}

export interface VisitPayment {
  paidAmount: Money;
  method?: string;
}

export interface ClientMoney {
  /** «Продано» — визиты «Пришёл» + перенесённое из старой программы */
  sold: Money;
  /** «Оплачено» — оплаты визитов + внесённое на счёт сверх них */
  paid: Money;
  /** paid − sold: меньше нуля — долг, больше — аванс */
  balance: Money;
  /** Оплаты одних визитов (без внесённого сверх) — нужна форме, чтобы поле «Оплачено» правило только добавку */
  visitsPaid: Money;
}

/** Ключ визита: записи одного прихода делят visitId */
export function visitKey(b: Pick<MoneyBooking, 'id' | 'visitId'>): Id {
  return b.visitId ?? b.id;
}

/** Сколько оплачено за визит: явная оплата — как есть, иначе визит «Пришёл» оплачен полностью */
export function visitPaid(total: Money, status: BookingStatus, payment: VisitPayment | undefined): Money {
  if (payment) return payment.paidAmount;
  return status === 'arrived' ? total : 0;
}

/**
 * @param bookings записи клиента (любые — считаются только «Пришёл» и не удалённые снаружи)
 * @param payments явные оплаты по ключу визита
 * @param extraPaid внесено на счёт сверх визитов (профиль)
 * @param importedSold «Продано» из импорта
 * @param standaloneSold F-04-219: продажи вне визита (товар/абонемент/сертификат из «Продать ▾»), привязанные к
 *   клиенту — всегда оплачены сразу, поэтому прибавляются и к «Продано», и к «Оплачено» одинаково.
 */
export function clientMoney(
  bookings: MoneyBooking[],
  payments: Record<Id, VisitPayment>,
  extraPaid: Money,
  importedSold: Money,
  standaloneSold: Money = 0,
): ClientMoney {
  const groups = new Map<Id, Money>();
  bookings
    .filter((b) => b.status === 'arrived')
    .forEach((b) => {
      const key = visitKey(b);
      groups.set(key, (groups.get(key) ?? 0) + b.total);
    });
  let soldVisits = 0;
  let visitsPaid = 0;
  groups.forEach((total, key) => {
    soldVisits += total;
    visitsPaid += visitPaid(total, 'arrived', payments[key]);
  });
  const sold = soldVisits + importedSold + standaloneSold;
  const paid = visitsPaid + extraPaid + standaloneSold;
  return { sold, paid, balance: paid - sold, visitsPaid };
}

/** Поле «Оплачено» в форме показывает всё оплаченное; сохраняем только то, что сверх оплат визитов */
export function extraPaidFromTotal(totalPaid: Money, visitsPaid: Money): Money {
  return totalPaid - visitsPaid;
}

export type BalanceKind = 'debt' | 'advance' | 'zero';

/** Долг / аванс / ноль — словом на экране, а не только цветом и знаком минус (ux-best-c1 №2) */
export function balanceKind(balance: Money): BalanceKind {
  if (balance < 0) return 'debt';
  if (balance > 0) return 'advance';
  return 'zero';
}

/**
 * Неявки клиента — из самих записей (recheck-c2 №2, e2e-q2 №1): «Не пришёл» + поздние отмены (Booking.cancelledLate,
 * их ядро тоже засчитывает в неявки). Счётчик в карточке, на чипе «Часто не приходят» и в окне записи — одно число.
 */
export function countNoShows(bookings: { status: BookingStatus; cancelledLate?: boolean; deletedAt?: string }[]): number {
  return bookings.filter((b) => !b.deletedAt && (b.status === 'no_show' || b.cancelledLate === true)).length;
}
