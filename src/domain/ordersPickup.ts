/**
 * ⭐ Выдача по времени (06.10.2026): заказ «Готов» — клиент на /o/<код> сам выбирает, когда придёт забрать. То же окно,
 * что у «Записи на сдачу» (длина, кто принимает, часы), но запись — на вторую скрытую услугу «Выдача заказа»
 * (Service.kind = 'pickup', onlineBookable = false): в каталоге, на странице мастерской и в общем потоке онлайн-записи её
 * нет, записывает только ссылка заказа — одна активная запись на заказ (Order.pickupBookingId). В журнале — «Выдача: №…»,
 * в «Заказах» — «Забирают сегодня» с «Выдать»; «Сдают сегодня» её не видит (там только услуга intake).
 * Те же правила, что у сервера (booktime-backend: modules/orders/order-rules.ts, order-pickup.service.ts).
 * Экраны импортируют из '@/domain/orders'.
 */
import type { Booking, BookingStatus, ISODate, ISODateTime, Id, LocalizedText, Service } from '@/domain/core';
import type { OrderStatus } from '@/domain/orders';
import { addDays } from '@/lib/date';

/** Название второй скрытой услуги — его видят клиент (в своих записях и напоминаниях) и журнал */
export const PICKUP_SERVICE_NAME: LocalizedText = { ru: 'Выдача заказа', hy: 'Պատվերի ստացում', en: 'Order pickup' };

/** На сколько дней вперёд (включая сегодня) клиент выбирает время, когда заберёт */
export const PICKUP_DAYS = 7;

/** Комментарий записи на выдачу — не длиннее */
export const PICKUP_COMMENT_MAX = 150;

/** Скрытая услуга «Выдача заказа» */
export function isPickupService(s: Pick<Service, 'kind'> | undefined | null): boolean {
  return s?.kind === 'pickup';
}

/** Скрытые услуги раздела «Заказы» («Приём заказа», «Выдача заказа») — не показывать в каталоге, выборе услуг и настройках */
export function isOrderService(s: Pick<Service, 'kind'> | undefined | null): boolean {
  return s?.kind === 'intake' || s?.kind === 'pickup';
}

/** Запись — «Выдача заказа»: среди строк записи есть услуга мастерской pickup */
export function isPickupBooking(booking: Pick<Booking, 'services'>, pickupServiceId: Id | null | undefined): boolean {
  return Boolean(pickupServiceId) && booking.services.some((l) => l.serviceId === pickupServiceId);
}

/** Выбрать время выдачи можно только у готового заказа */
export function canBookPickup(status: OrderStatus): boolean {
  return status === 'ready';
}

/** Комментарий записи на выдачу — что забирают: «№1024 · iPhone 14 — замена экрана» */
export function pickupBookingComment(number: number, items: readonly { title: string; qty: number }[]): string {
  const what = items.map((i) => (i.qty > 1 ? `${i.title} ×${i.qty}` : i.title)).join(' · ');
  const text = what ? `№${number} · ${what}` : `№${number}`;
  return text.length > PICKUP_COMMENT_MAX ? `${text.slice(0, PICKUP_COMMENT_MAX - 1)}…` : text;
}

/** Дни, из которых клиент выбирает: сегодня и ещё PICKUP_DAYS − 1 */
export function pickupDates(today: ISODate): ISODate[] {
  return Array.from({ length: PICKUP_DAYS }, (_, i) => addDays(today, i));
}

/** Что видит клиент на /o/<код> про выдачу (только у готового заказа) */
export interface PublicOrderPickup {
  /** Можно выбрать или поменять время (мастерская принимает по времени) */
  enabled: boolean;
  slotMin: number;
  /** Его запись на выдачу (время — Ереван); null — ещё не выбирал */
  booking: { start: ISODateTime; status: BookingStatus } | null;
}

/** Свободное время выдачи — по дням, только дни, где оно есть */
export interface PickupSlots {
  slotMin: number;
  days: { date: ISODate; slots: ISODateTime[] }[];
}

/** «Забирают сегодня»: запись на выдачу и её заказ */
export interface PickupBooking {
  bookingId: Id;
  start: ISODateTime;
  durationMin: number;
  status: BookingStatus;
  staffId: Id;
  clientId: Id | null;
  clientName: string;
  clientPhone: string;
  orderId: Id | null;
  orderNumber: number | null;
  orderStatus: OrderStatus | null;
  /** Что забирают */
  items: string | null;
}
