/**
 * ЦЕНА, ДЛИТЕЛЬНОСТЬ, СКИДКА, ПРЕДОПЛАТА — единый источник правды (F-00-057, F-00-097, F-06-184, arch-a1 №3).
 * Деньги — целые драмы; округление — до драма (Math.round) один раз, на цене единицы.
 *
 * Решения:
 *  - длительность «от–до» бронирует ВЕРХНЮЮ границу (F-00-057: «услуга 1–1,5 ч закрывает 1,5 ч плюс запас»);
 *  - цена «от–до» при записи ставится по НИЖНЕЙ границе (клиенту обещано «от»; итог мастер правит на визите),
 *    клиенту показывается диапазон priceRange();
 *  - скидка — процент на строку (unitPrice → price); итог строки = price × qty, итог записи = сумма строк —
 *    ровно так считает createBooking() в ядре, поэтому делением восстанавливать скидку не нужно.
 */
import type { BookingServiceLine, ISODateTime, Id, Minutes, Money, PrepaymentRule, Service } from '@/domain/core';
import { addMinutes } from '@/lib/date';

/** Бронируемая длительность услуги: для «от–до» — верхняя граница */
export function bookedDuration(service: Pick<Service, 'durationMin' | 'durationMax'>): Minutes {
  return service.durationMax && service.durationMax > service.durationMin ? service.durationMax : service.durationMin;
}

/** Цена услуги при записи (нижняя граница «от–до») */
export function bookedPrice(service: Pick<Service, 'priceMin'>): Money {
  return service.priceMin;
}

/** Диапазон цены для показа: max есть только если он больше min */
export function priceRange(service: Pick<Service, 'priceMin' | 'priceMax'>): { min: Money; max?: Money } {
  return service.priceMax && service.priceMax > service.priceMin
    ? { min: service.priceMin, max: service.priceMax }
    : { min: service.priceMin };
}

/** Диапазон длительности для показа */
export function durationRange(service: Pick<Service, 'durationMin' | 'durationMax'>): { min: Minutes; max?: Minutes } {
  return service.durationMax && service.durationMax > service.durationMin
    ? { min: service.durationMin, max: service.durationMax }
    : { min: service.durationMin };
}

/** Процент скидки в пределах 0–100 */
export function clampPct(pct: number | undefined): number {
  if (!pct || !Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

/** Цена после скидки, до драма */
export function applyDiscount(amount: Money, discountPct?: number): Money {
  return Math.round((amount * (100 - clampPct(discountPct))) / 100);
}

/** Цена единицы строки после скидки */
export function lineUnitPrice(line: Pick<BookingServiceLine, 'price' | 'unitPrice' | 'discountPct'>): Money {
  return line.unitPrice !== undefined ? applyDiscount(line.unitPrice, line.discountPct) : line.price;
}

/** Итог строки: цена единицы после скидки × количество */
export function lineTotal(line: Pick<BookingServiceLine, 'price' | 'unitPrice' | 'discountPct' | 'qty'>): Money {
  return lineUnitPrice(line) * line.qty;
}

/** Скидка строки в драмах (для чека и отчётов) */
export function lineDiscount(line: Pick<BookingServiceLine, 'price' | 'unitPrice' | 'discountPct' | 'qty'>): Money {
  return line.unitPrice !== undefined ? (line.unitPrice - lineUnitPrice(line)) * line.qty : 0;
}

/** Строка товара в визите (у товаров своя форма — stock/journal; нужны только эти поля) */
export interface GoodsLineLike {
  price: Money;
  qty: number;
  discountPct?: number;
}

/** Итог визита: услуги + товары, каждая строка со своей скидкой */
export function visitTotal(
  lines: readonly Pick<BookingServiceLine, 'price' | 'unitPrice' | 'discountPct' | 'qty'>[],
  goods: readonly GoodsLineLike[] = [],
): Money {
  const services = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const items = goods.reduce((sum, g) => sum + applyDiscount(g.price, g.discountPct) * g.qty, 0);
  return services + items;
}

/** Длительность записи по строкам (как считает createBooking) */
export function linesDuration(lines: readonly Pick<BookingServiceLine, 'durationMin' | 'qty'>[]): Minutes {
  return lines.reduce((sum, l) => sum + l.durationMin * l.qty, 0);
}

/**
 * Собрать строку услуги записи: длительность «от–до» → верхняя граница, цена → нижняя, скидка → unitPrice + price.
 * Цену можно задать вручную (журнал правит цену на визите) — она считается ценой ДО скидки.
 */
export function makeServiceLine(
  service: Pick<Service, 'id' | 'durationMin' | 'durationMax' | 'priceMin'>,
  staffId: Id,
  opts: { qty?: number; discountPct?: number; unitPrice?: Money; durationMin?: Minutes } = {},
): BookingServiceLine {
  const unit = opts.unitPrice ?? bookedPrice(service);
  const pct = clampPct(opts.discountPct);
  return {
    serviceId: service.id,
    staffId,
    durationMin: opts.durationMin ?? bookedDuration(service),
    qty: Math.max(1, opts.qty ?? 1),
    price: applyDiscount(unit, pct),
    ...(pct > 0 ? { unitPrice: unit, discountPct: pct } : {}),
  };
}

// ─────────────────────────── Предоплата (F-00-097) ───────────────────────────

/** Правило мастера или его публичная часть (без реквизитов) */
type PrepaymentLike = Pick<PrepaymentRule, 'amount' | 'percent'> & Partial<PrepaymentRule>;

/** Мастер берёт предоплату: задан процент или сумма больше нуля */
export function hasPrepayment(rule: PrepaymentLike | undefined): boolean {
  return Boolean(rule && ((rule.percent ?? 0) > 0 || rule.amount > 0));
}

/**
 * ⭐ Предоплату вносят ВСЕ клиенты мастера (а не только те, кто уже не приходил — PrepaymentRule.onlyAfterNoShows).
 * Для подсказок «у мастера предоплата» до записи; кому она нужна при записи — `prepaymentNeed` (rules/booking-policy).
 */
export function prepaymentForEveryone(rule: (PrepaymentLike & { onlyAfterNoShows?: unknown }) | undefined): boolean {
  return hasPrepayment(rule) && !rule?.onlyAfterNoShows;
}

/**
 * Сумма предоплаты мастера — не больше суммы записи; 0 — предоплата не нужна. Процент считается от суммы записи
 * и округляется вверх до 100 ֏ (переводят круглые суммы); `full` — клиент выбрал «Оплатить всё сразу».
 */
export function prepaymentAmount(rule: PrepaymentLike | undefined, total: Money, full = false): Money {
  if (!rule || !hasPrepayment(rule)) return 0;
  if (full && total > 0) return total;
  if (rule.percent) return total > 0 ? Math.min(total, Math.ceil((total * Math.min(rule.percent, 100)) / 100 / 100) * 100) : 0;
  return total > 0 ? Math.min(rule.amount, total) : rule.amount;
}

/** Цена известна точно — у услуг нет «от–до»; иначе «всю сумму сразу» не посчитать */
export function hasExactPrice(services: readonly Pick<Service, 'priceMin' | 'priceMax'>[]): boolean {
  return services.every((s) => s.priceMax === undefined || s.priceMax === s.priceMin);
}

/** Есть смысл предлагать «Оплатить всё сразу»: предоплата меньше суммы записи */
export function canPayInFull(rule: PrepaymentLike | undefined, total: Money): boolean {
  return total > 0 && hasPrepayment(rule) && prepaymentAmount(rule, total) < total;
}

/** Сколько клиент уже заплатил предоплатой (мастер отметил «получена») — на визите берём только остаток */
export function prepaidAmount(booking: { prepayment?: { amount: Money; paid: boolean } }): Money {
  return booking.prepayment?.paid ? booking.prepayment.amount : 0;
}

/** До какого момента окно держится без «Я оплатил» */
export function prepaymentHoldUntil(rule: Pick<PrepaymentRule, 'timeoutMin'>, now: ISODateTime): ISODateTime {
  return addMinutes(now, Math.max(1, rule.timeoutMin));
}
