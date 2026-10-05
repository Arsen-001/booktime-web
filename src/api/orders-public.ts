'use client';

/**
 * Заказ для клиента без входа (страница /o/<код>): статус, смета, время выдачи. В режиме api — запрос к серверу; в
 * демо — модуль раздела догружается отдельным куском (viaMock), поэтому страница заказа не тянут код кабинета.
 * Те же функции реэкспортирует '@/api/orders' — экраны кабинета импортируют оттуда, как раньше.
 * (Не путать с '@/api/ordersPublic' — это вид заказа для мока, внутри request().)
 */
import { isApiMode } from '@/api/http';
import * as S from '@/api/orders.server';
import { viaMock } from '@/api/request';
import type { Id, ISODateTime } from '@/domain/core';
import type { EstimateDecision, OrdersQuery, OrderStatus, PickupSlots, PublicOrder } from '@/domain/orders';
import { pickText } from '@/lib/text';

const orders = () => import('@/api/orders');
const pickup = () => import('@/api/ordersPickup');
const estimate = () => import('@/api/ordersEstimate');

/** Ключи запросов раздела: ['orders', <ресурс>, …] */
export const ordersKeys = {
  all: ['orders'] as const,
  list: (businessId: Id, query: OrdersQuery) => ['orders', 'list', businessId, query] as const,
  count: (businessId: Id, status: OrderStatus) => ['orders', 'count', businessId, status] as const,
  order: (businessId: Id, orderId: Id) => ['orders', 'order', businessId, orderId] as const,
  public: (code: string) => ['orders', 'public', code] as const,
  enabled: (businessId: Id) => ['orders', 'enabled', businessId] as const,
  pickupReminders: (businessId: Id) => ['orders', 'pickup-reminders', businessId] as const,
  intake: (businessId: Id) => ['orders', 'intake', businessId] as const,
  intakeBookings: (businessId: Id, date: string) => ['orders', 'intake-bookings', businessId, date] as const,
  pickupBookings: (businessId: Id, date: string) => ['orders', 'pickup-bookings', businessId, date] as const,
  pickupSlots: (code: string) => ['orders', 'pickup-slots', code] as const,
};

/** Адрес бизнеса для публичной страницы: строка сервера или текст мока на языке страницы */
export function publicAddressText(address: PublicOrder['business']['address'], locale: 'ru' | 'en' | 'hy'): string {
  if (!address) return '';
  return typeof address === 'string' ? address : pickText(address, locale);
}

/** Публичный статус по коду ссылки — без входа (страница /o/<code>) */
export function getPublicOrder(code: string): Promise<PublicOrder> {
  if (isApiMode()) return S.getPublicOrderServer(code);
  return viaMock(orders, (m) => m.getPublicOrderMock(code));
}

/** Окна выдачи на неделю вперёд: начало подходит, если свободен хоть один из тех, кто выдаёт */
export function getPublicPickupSlots(code: string): Promise<PickupSlots> {
  if (isApiMode()) return S.getPublicPickupSlotsServer(code);
  return viaMock(pickup, (m) => m.getPublicPickupSlotsMock(code));
}

/** «Не смогу в это время»: снять запись на выдачу (её нет — без изменений) */
export function cancelPublicPickup(code: string): Promise<PublicOrder> {
  if (isApiMode()) return S.cancelPublicPickupServer(code);
  return viaMock(pickup, (m) => m.cancelPublicPickupMock(code));
}

/**
 * Выбрать или поменять время выдачи. Тот же выбор — без изменений; другое время — новая запись, прежняя снимается
 * («Отменил клиент», без правил поздней отмены — это не визит). Ответ — публичный вид заказа.
 */
export function bookPublicPickup(args: { code: string; start: ISODateTime }): Promise<PublicOrder> {
  if (isApiMode()) return S.bookPublicPickupServer(args.code, args.start);
  return viaMock(pickup, (m) => m.bookPublicPickupMock(args));
}

/**
 * Клиент по ссылке /o/<code>, без входа: «Согласен» / «Отказаться» на смету версии version. Повтор того же ответа —
 * успех без изменений; смету обновили — ApiError('estimate_changed'); уже ответили иначе — 'estimate_already_decided'.
 */
export function decidePublicEstimate(args: { code: string; decision: EstimateDecision; version: number; comment?: string | null }): Promise<PublicOrder> {
  if (isApiMode()) return S.decidePublicEstimateServer(args.code, args.decision, args.version, args.comment ?? null);
  return viaMock(estimate, (m) => m.decidePublicEstimateMock(args));
}
