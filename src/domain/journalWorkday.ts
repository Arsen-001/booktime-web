/**
 * ⭐ Рабочий день журнала (владелец, 01.10.2026 — пункты 5, 6, 7): утренняя сводка, незакрытые визиты, итоги дня.
 * Типы ответа (мок src/api/journal-workday.ts и сервер booktime-backend src/modules/workday отдают одно и то же) и
 * чистые правила: что считать «незакрытым визитом», чей сегодня день рождения.
 */
import type { Booking, BookingStatus, ISODate, ISODateTime, Id, Money } from '@/domain/core';
import { bookingEnd } from '@/domain/rules/booking-status';

/** Статусы «до прихода»: у прошедшей записи в них не отмечено ни «Пришёл», ни «Не пришёл» */
export const BEFORE_ARRIVAL_STATUSES: readonly BookingStatus[] = ['awaiting_confirmation', 'awaiting_prepayment', 'scheduled', 'client_confirmed'];

/** Сколько дней назад смотрим незакрытые визиты — как «Пришли, но не оплатили» финансов */
export const UNCLOSED_DAYS = 14;
/** За сколько дней собираем долги клиентов в утренней сводке */
export const DEBT_DAYS = 365;
/** Предоплаты без подтверждения — на сколько дней вперёд */
export const PREPAYMENT_AHEAD_DAYS = 30;

/** Почему визит не закрыт: не отмечен приход (или «не пришёл») / пришёл, но не оплатил */
export type UnclosedReason = 'arrival' | 'payment';

/** Строка записи в сводках — без лишнего: время, мастер, клиент, услуги, сумма, статус */
export interface WorkdayItem {
  bookingId: Id;
  start: ISODateTime;
  durationMin: number;
  staffId: Id;
  clientId?: Id;
  /** Имя из карточки клиента или «посетитель» записи */
  clientName?: string;
  serviceIds: Id[];
  total: Money;
  status: BookingStatus;
  /** Клиент нажал «Я оплатил» — предоплата ждёт подтверждения */
  reported?: boolean;
}

export interface WorkdayBirthday {
  clientId: Id;
  name: string;
  birthday: ISODate;
  /** Сколько исполняется (если год рождения известен) */
  age?: number;
  /** Запись клиента в этот день, если есть */
  bookingId?: Id;
  start?: ISODateTime;
}

export interface WorkdayDebt {
  clientId: Id;
  name: string;
  amount: Money;
  visits: number;
  lastVisit: ISODate;
}

/** Утренняя сводка (пункт 5) */
export interface MorningSummary {
  date: ISODate;
  /** Записи дня (без отменённых) */
  bookings: WorkdayItem[];
  /** «Записан», клиент ещё не подтвердил */
  notConfirmed: WorkdayItem[];
  /** Заявки, на которые салон ещё не ответил */
  requests: WorkdayItem[];
  /** Первый визит: раньше этого дня клиент ни разу не приходил */
  newClients: WorkdayItem[];
  birthdays: WorkdayBirthday[];
  /** Ждут предоплату — с этого дня и на PREPAYMENT_AHEAD_DAYS вперёд */
  prepayments: WorkdayItem[];
  /** Должники — первые 50 по сумме долга */
  debts: WorkdayDebt[];
  /** Все должники и общий долг (список выше — только первые 50) */
  debtTotal: { clients: number; amount: Money };
  /** Незакрытые визиты прошлых дней */
  unclosedCount: number;
}

/** Незакрытый визит (пункт 6) — с самой записью, чтобы закрыть его тем же действием, что в журнале */
export interface UnclosedVisit {
  booking: Booking;
  clientName?: string;
  /** Сумма визита к оплате (услуги + товары) */
  total: Money;
  paid: Money;
  due: Money;
  reason: UnclosedReason;
}

/** Итоги дня (пункт 7); смена и пересчёт ящика — кассовая смена финансов */
export interface DayCloseSummary {
  date: ISODate;
  counts: { bookings: number; arrived: number; noShow: number; cancelled: number; unclosed: number };
  revenue: { booked: Money; done: Money };
  /** Деньги кассы за день: приход по способам, возвраты и прочие расходы (у мастера — нули) */
  money: { cash: Money; card: Money; transfer: Money; other: Money; totalIn: Money; refunds: Money; expense: Money };
  noShows: WorkdayItem[];
  cancellations: WorkdayItem[];
}

/** Незакрыт ли визит и почему: прошёл без отметки прихода — «arrival»; «Пришёл» с остатком к оплате — «payment» */
export function unclosedReason(b: Pick<Booking, 'status' | 'start' | 'durationMin' | 'deletedAt'>, due: Money, now: ISODateTime): UnclosedReason | null {
  if (b.deletedAt) return null;
  if (BEFORE_ARRIVAL_STATUSES.includes(b.status)) return bookingEnd(b) <= now ? 'arrival' : null;
  if (b.status === 'arrived' && due > 0) return 'payment';
  return null;
}

/** Запись-блок без клиента и без суммы закрывать нечего */
export function isClosableVisit(b: Pick<Booking, 'clientId' | 'visitorName' | 'total'>): boolean {
  return Boolean(b.clientId || b.visitorName || b.total > 0);
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** День рождения в этот день; родившимся 29 февраля в невисокосный год — 28-го */
export function isBirthdayOn(birthday: ISODate | undefined, date: ISODate): boolean {
  if (!birthday || birthday.length < 10) return false;
  const md = birthday.slice(5, 10);
  if (md === date.slice(5, 10)) return true;
  return md === '02-29' && !isLeap(Number(date.slice(0, 4))) && date.slice(5, 10) === '02-28';
}

/** Сколько лет исполняется в этот день (год рождения неизвестен или странный — undefined) */
export function ageOn(birthday: ISODate, date: ISODate): number | undefined {
  const y = Number(birthday.slice(0, 4));
  if (!y || y < 1900) return undefined;
  const age = Number(date.slice(0, 4)) - y - (date.slice(5, 10) < birthday.slice(5, 10) ? 1 : 0);
  return age > 0 && age < 120 ? age : undefined;
}

// ─────────── Деньги кассы за день (итоги дня и уведомление владельцу) ───────────

export interface DayMoneyOp {
  id: Id;
  accountId: Id;
  kind: string;
  amount: Money;
  method: string;
  itemId?: Id;
  date: string;
  cancelled?: boolean;
}

export interface DayMoney {
  cash: Money;
  card: Money;
  transfer: Money;
  other: Money;
  refunds: Money;
  expense: Money;
}

/**
 * Деньги кассы за день — операции касс бизнеса датой этого дня (как «Касса за день» финансов): приход по способам,
 * возвраты и прочие расходы. Поправки пересчёта ящика (открытие/закрытие смены) — не выручка и не расход дня.
 */
export function dayMoneyOf(
  ops: readonly DayMoneyOp[],
  opts: { date: ISODate; accountIds: ReadonlySet<Id>; refundItemId?: Id; adjustmentIds: ReadonlySet<Id> },
): DayMoney {
  const money: DayMoney = { cash: 0, card: 0, transfer: 0, other: 0, refunds: 0, expense: 0 };
  for (const op of ops) {
    if (!opts.accountIds.has(op.accountId) || op.cancelled || !op.date.startsWith(opts.date) || opts.adjustmentIds.has(op.id)) continue;
    if (op.kind === 'income') {
      const m = op.method === 'cash' || op.method === 'card' || op.method === 'transfer' ? op.method : 'other';
      money[m] += op.amount;
    } else if (op.kind === 'expense') {
      if (opts.refundItemId && op.itemId === opts.refundItemId) money.refunds += op.amount;
      else money.expense += op.amount;
    }
  }
  return money;
}

// ─────────── ⭐ «Закрыт день» — уведомление владельцу в колокольчик (владелец, 01.10.2026) ───────────

/**
 * Снимок итога дня в момент закрытия кассовой смены: выручка (оказано услуг — как «Выручка» в «Итогах дня»),
 * наличные за день и излишек/недостача пересчёта (сумма по сменам, закрытым в этот день). Один снимок на бизнес и
 * день: повторное закрытие с теми же цифрами ничего не меняет, с другими — заменяет снимок и снова «не прочитано».
 * Получатели — владельцы бизнеса (и сотрудники с ролью-шаблоном «Владелец»), кроме того, кто закрыл.
 */
export interface DayCloseNotice {
  businessId: Id;
  date: ISODate;
  at: ISODateTime;
  closedBy: Id;
  closedByName: string;
  revenue: Money;
  cash: Money;
  /** Посчитали − должно быть: плюс — излишек, минус — недостача, 0 — сошлось */
  discrepancy: Money;
  recipientStaffIds: Id[];
  /** Отпечаток цифр и закрывшего — по нему «без изменений» не дублирует уведомление */
  fingerprint: string;
}

/** FNV-1a 32 бита в base36 — короткий стабильный хэш (id строки ленты ≤ 32 символов, как у сервера) */
export function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

export function dayCloseFingerprint(n: Pick<DayCloseNotice, 'closedBy' | 'revenue' | 'cash' | 'discrepancy'>): string {
  return shortHash(`${n.closedBy}|${n.revenue}|${n.cash}|${n.discrepancy}`);
}

/** id строки колокольчика: свой у каждого получателя (прочитанное одним владельцем не гасит строку у другого) */
export function dayCloseInboxId(n: Pick<DayCloseNotice, 'date' | 'fingerprint'>, viewerStaffId: Id): string {
  return `dc_${n.date.replace(/-/g, '')}_${shortHash(`${n.fingerprint}|${viewerStaffId}`)}`;
}

/**
 * Положить снимок дня в список: тот же день с тем же отпечатком — без изменений (changed: false), другой — заменяет
 * прежний снимок этого дня. Хранится не больше `keep` последних дней.
 */
export function upsertDayCloseNotice(list: readonly DayCloseNotice[], next: DayCloseNotice, keep = 30): { list: DayCloseNotice[]; changed: boolean } {
  const prev = list.find((n) => n.businessId === next.businessId && n.date === next.date);
  if (prev && prev.fingerprint === next.fingerprint && prev.recipientStaffIds.join(',') === next.recipientStaffIds.join(',')) {
    return { list: [...list], changed: false };
  }
  const rest = list.filter((n) => !(n.businessId === next.businessId && n.date === next.date));
  const out = [...rest, next].sort((a, b) => (a.at < b.at ? 1 : -1));
  const perBiz = new Map<Id, number>();
  return {
    list: out.filter((n) => {
      const c = (perBiz.get(n.businessId) ?? 0) + 1;
      perBiz.set(n.businessId, c);
      return c <= keep;
    }),
    changed: true,
  };
}
