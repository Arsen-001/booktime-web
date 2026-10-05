'use client';

/**
 * ⭐ Выдача по времени (06.10.2026): клиент на /o/<код> выбирает, когда заберёт готовый заказ, — окна на неделю, выбрать
 * или поменять время, «Не смогу»; кабинет — «Забирают сегодня». Запись — общий движок ядра (coreTx.placeBooking с
 * orderPickup) на скрытую услугу «Выдача заказа»; одна активная запись на заказ (Order.pickupBookingId).
 * Мок повторяет сервер (booktime-backend: modules/orders/order-pickup.service.ts); экраны импортируют из '@/api/orders'.
 */
import { mutateArea, readArea, readCore } from '@/api/area';
import { coreTx } from '@/api/core';
import { isApiMode } from '@/api/http';
import * as S from '@/api/orders.server';
import { intakeServiceTx } from '@/api/ordersIntake';
import { publicOrderTx } from '@/api/ordersPublic';
import { ApiError, request } from '@/api/request';
import { computeFreeSlots } from '@/api/schedule';
import type { Booking, Id, ISODate, ISODateTime, Service } from '@/domain/core';
import {
  canBookPickup,
  defaultOrdersEnabled,
  INTAKE_CLOSED_STATUSES,
  intakeSlotOf,
  isPickupBooking,
  isPickupService,
  orderItemsSummary,
  PICKUP_SERVICE_NAME,
  pickupBookingComment,
  pickupDates,
  type Order,
  type PickupBooking,
  type PickupSlots,
  type PublicOrder,
  type PublicOrderPickup,
} from '@/domain/orders';
import { nowDateTime } from '@/lib/date';

/** Услуга «Выдача заказа» бизнеса (мок, внутри request) */
export function pickupServiceTx(businessId: Id): Service | undefined {
  return readCore().services.find((s) => s.businessId === businessId && isPickupService(s));
}

/** «Выдача заказа» вслед за «Приёмом заказа»: то же окно, те же люди, включена вместе с ним; всегда не онлайн */
export function syncPickupServiceTx(args: { businessId: Id; sphereId: Service['sphereId']; durationMin: number; staffIds: Id[]; enabled: boolean }): Service {
  const fields = { durationMin: args.durationMin, staffIds: args.staffIds, active: args.enabled, onlineBookable: false };
  const existing = pickupServiceTx(args.businessId);
  if (existing) return coreTx.update('services', existing.id, fields);
  return coreTx.create('services', {
    businessId: args.businessId,
    categoryId: '',
    sphereId: args.sphereId,
    name: { ...PICKUP_SERVICE_NAME },
    kind: 'pickup',
    priceMin: 0,
    bufferAfterMin: 0,
    photos: [],
    materials: [],
    workplaces: ['salon'],
    order: 0,
    ...fields,
  });
}

interface PickupSetup {
  enabled: boolean;
  slotMin: number;
  staffIds: Id[];
  service: Service | undefined;
}

/** Выдача по времени у бизнеса: включены «Заказы» и «Запись на сдачу» (и сама «Выдача заказа»). undefined — приём не включали */
function pickupSetupTx(businessId: Id): PickupSetup | undefined {
  const business = readCore().businesses.find((b) => b.id === businessId);
  const intake = intakeServiceTx(businessId);
  if (!business || !intake) return undefined;
  const pickup = pickupServiceTx(businessId);
  const ordersOn = readArea('orders').settings[businessId]?.ordersEnabled ?? defaultOrdersEnabled(business.sphereIds);
  const staffIds = (pickup ?? intake).staffIds;
  const enabled = ordersOn && intake.active && intake.onlineBookable && (!pickup || pickup.active) && staffIds.length > 0;
  return { enabled, slotMin: intakeSlotOf((pickup ?? intake).durationMin), staffIds, service: pickup };
}

/** Выдача по времени включена у бизнеса (мок, внутри request): для текста «Заказ готов» */
export function pickupEnabledTx(businessId: Id): boolean {
  return Boolean(pickupSetupTx(businessId)?.enabled);
}

/** Действующая запись на выдачу заказа: не удалена и не отменена */
export function activePickupBookingTx(order: Pick<Order, 'businessId' | 'pickupBookingId'>): Booking | undefined {
  if (!order.pickupBookingId) return undefined;
  const b = readCore().bookings.find((x) => x.id === order.pickupBookingId && x.businessId === order.businessId && !x.deletedAt);
  return b && !INTAKE_CLOSED_STATUSES.includes(b.status) ? b : undefined;
}

/** Что видит клиент на /o/<код> про выдачу (мок, внутри request) */
export function publicPickupTx(order: Order): PublicOrderPickup | null {
  if (!canBookPickup(order.status)) return null;
  const setup = pickupSetupTx(order.businessId);
  const booking = activePickupBookingTx(order);
  if (!setup?.enabled && !booking) return null;
  return {
    enabled: Boolean(setup?.enabled),
    slotMin: setup?.slotMin ?? intakeSlotOf(booking?.durationMin),
    booking: booking ? { start: booking.start, status: booking.status } : null,
  };
}

function orderByCodeTx(code: string): Order {
  const order = readArea('orders').orders.find((o) => o.code === code);
  if (!order) throw new ApiError('not_found', 'Заказ не найден');
  return order;
}

function readySetupTx(order: Order): PickupSetup {
  if (!canBookPickup(order.status)) throw new ApiError('order_not_ready', 'Заказ ещё не готов');
  const setup = pickupSetupTx(order.businessId);
  if (!setup?.enabled) throw new ApiError('pickup_disabled', 'Мастерская не принимает по времени');
  return setup;
}

/** Кто может выдать: активные и с онлайн-записью; мастер заказа — первым */
function staffForTx(order: Order, setup: PickupSetup): Id[] {
  const staff = readCore().staff;
  const ok = setup.staffIds.filter((id) => staff.some((s) => s.id === id && s.businessId === order.businessId && s.status === 'active' && s.onlineBookingEnabled !== false));
  return order.staffId && ok.includes(order.staffId) ? [order.staffId, ...ok.filter((id) => id !== order.staffId)] : ok;
}

function freeStartsTx(order: Order, setup: PickupSetup, staffId: Id, date: ISODate): ISODateTime[] {
  return computeFreeSlots(readCore(), { staffId, date, durationMin: setup.slotMin, locationId: order.locationId ?? undefined, serviceId: setup.service?.id }).map((s) => s.start);
}

/** Окна выдачи на неделю вперёд: начало подходит, если свободен хоть один из тех, кто выдаёт */
export function getPublicPickupSlots(code: string): Promise<PickupSlots> {
  if (isApiMode()) return S.getPublicPickupSlotsServer(code);
  return request(() => {
    const order = orderByCodeTx(code);
    const setup = readySetupTx(order);
    const staff = staffForTx(order, setup);
    const days = pickupDates(nowDateTime().slice(0, 10))
      .map((date) => ({ date, slots: [...new Set(staff.flatMap((id) => freeStartsTx(order, setup, id, date)))].sort() }))
      .filter((d) => d.slots.length > 0);
    return { slotMin: setup.slotMin, days };
  });
}

/**
 * Выбрать или поменять время выдачи. Тот же выбор — без изменений; другое время — новая запись, прежняя снимается
 * («Отменил клиент», без правил поздней отмены — это не визит). Ответ — публичный вид заказа.
 */
export function bookPublicPickup(args: { code: string; start: ISODateTime }): Promise<PublicOrder> {
  const { code, start } = args;
  if (isApiMode()) return S.bookPublicPickupServer(code, start);
  return request(() => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) throw new ApiError('validation', 'start');
    const order = orderByCodeTx(code);
    const setup = readySetupTx(order);
    const current = activePickupBookingTx(order);
    if (current?.start === start) return publicOrderTx(code);
    if (!pickupDates(nowDateTime().slice(0, 10)).includes(start.slice(0, 10))) throw new ApiError('slot_taken', 'Вне недели выдачи');
    const staffId = staffForTx(order, setup).find((id) => freeStartsTx(order, setup, id, start.slice(0, 10)).includes(start));
    if (!staffId) throw new ApiError('slot_taken', 'Это время уже заняли');
    const business = readCore().businesses.find((b) => b.id === order.businessId);
    // Приём включили до 06.10.2026 — «Выдачу заказа» заводим сейчас, с окном и людьми приёма
    const service =
      setup.service ??
      syncPickupServiceTx({ businessId: order.businessId, sphereId: business?.sphereIds[0] ?? 'general', durationMin: setup.slotMin, staffIds: setup.staffIds, enabled: true });
    const placed = coreTx.placeBooking(
      {
        source: 'link',
        businessId: order.businessId,
        staffId,
        start,
        services: [{ serviceId: service.id }],
        locationId: order.locationId ?? undefined,
        client: { phone: order.clientPhone, name: order.clientName },
        comment: pickupBookingComment(order.number, order.items),
        staffAssignment: 'any',
        orderPickup: true,
      },
      { isStartOffered: (q) => computeFreeSlots(readCore(), q).some((s) => s.start === q.start) },
    );
    mutateArea('orders', (s) => {
      const o = s.orders.find((x) => x.id === order.id);
      if (o) o.pickupBookingId = placed.booking.id;
    });
    if (current) coreTx.changeBookingStatus(current.id, 'cancelled_by_client', 'client');
    return publicOrderTx(code);
  });
}

/** «Не смогу в это время»: снять запись на выдачу (её нет — без изменений) */
export function cancelPublicPickup(code: string): Promise<PublicOrder> {
  if (isApiMode()) return S.cancelPublicPickupServer(code);
  return request(() => {
    const order = orderByCodeTx(code);
    const current = activePickupBookingTx(order);
    if (current) {
      coreTx.changeBookingStatus(current.id, 'cancelled_by_client', 'client');
      mutateArea('orders', (s) => {
        const o = s.orders.find((x) => x.id === order.id);
        if (o) o.pickupBookingId = null;
      });
    }
    return publicOrderTx(code);
  });
}

/** «Забирают сегодня»: записи на выдачу за день — кто придёт, за каким заказом и выдан ли он уже */
export function listPickupBookings(businessId: Id, date: ISODate): Promise<PickupBooking[]> {
  if (isApiMode()) return S.listPickupBookingsServer(businessId, date);
  return request(() => {
    const svc = pickupServiceTx(businessId);
    if (!svc) return [];
    const core = readCore();
    const orders = readArea('orders').orders.filter((o) => o.businessId === businessId && o.pickupBookingId);
    return core.bookings
      .filter((b) => b.businessId === businessId && !b.deletedAt && b.start.slice(0, 10) === date && !INTAKE_CLOSED_STATUSES.includes(b.status) && isPickupBooking(b, svc.id))
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((b) => {
        const client = b.clientId ? core.clients.find((c) => c.id === b.clientId) : undefined;
        const order = orders.find((o) => o.pickupBookingId === b.id);
        return {
          bookingId: b.id,
          start: b.start,
          durationMin: b.durationMin,
          status: b.status,
          staffId: b.staffId,
          clientId: b.clientId ?? null,
          clientName: b.visitorName ?? client?.name ?? '',
          clientPhone: client?.phone ?? '',
          orderId: order?.id ?? null,
          orderNumber: order?.number ?? null,
          orderStatus: order?.status ?? null,
          items: order ? orderItemsSummary(order.items) || null : (b.comment ?? null),
        };
      });
  });
}
