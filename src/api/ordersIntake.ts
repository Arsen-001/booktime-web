'use client';

/**
 * ⭐ Запись на сдачу по времени (05.10.2026) — настройка «Записи на сдачу» и «кто сдаёт сегодня». Сама запись клиента —
 * общий поток онлайн-записи (/b/<slug>/book на услугу «Приём заказа»), «Принять заказ» по записи — createOrder с bookingId.
 * Мок повторяет сервер (booktime-backend: modules/orders/order-intake.service.ts); экраны импортируют из '@/api/orders'.
 */
import { readArea, readCore } from '@/api/area';
import { coreTx } from '@/api/core';
import { isApiMode } from '@/api/http';
import { syncCore } from '@/api/mirror';
import * as S from '@/api/orders.server';
import { syncPickupServiceTx } from '@/api/ordersPickup';
import { ApiError, request } from '@/api/request';
import type { Id, ISODate, Service } from '@/domain/core';
import {
  INTAKE_CLOSED_STATUSES,
  INTAKE_SERVICE_NAME,
  intakeSettingsOf,
  isIntakeBooking,
  isIntakeService,
  type IntakeBooking,
  type IntakeSettings,
  type IntakeSettingsInput,
} from '@/domain/orders';

/** Услуга «Приём заказа» бизнеса (мок, внутри request) */
export function intakeServiceTx(businessId: Id): Service | undefined {
  return readCore().services.find((s) => s.businessId === businessId && isIntakeService(s));
}

export function getIntakeSettings(businessId: Id): Promise<IntakeSettings> {
  if (isApiMode()) return S.getIntakeSettingsServer(businessId);
  return request(() => intakeSettingsOf(intakeServiceTx(businessId)));
}

/** Включить/выключить «Запись на сдачу», длина окна, кто принимает (пусто — все активные) */
export function setIntakeSettings(args: { businessId: Id; input: IntakeSettingsInput }): Promise<IntakeSettings> {
  const { businessId, input } = args;
  if (isApiMode()) {
    // Услуга и Staff.serviceIds поменялись на сервере — зеркало ядра (журнал, окна) берёт их заново
    return S.setIntakeSettingsServer(businessId, input).then(async (res) => {
      await syncCore(businessId).catch(() => undefined);
      return res;
    });
  }
  return request(
    () => {
      const core = readCore();
      const business = core.businesses.find((b) => b.id === businessId);
      if (!business) throw new ApiError('not_found', 'Бизнес не найден');
      const staff = core.staff.filter((s) => s.businessId === businessId);
      const active = staff.filter((s) => s.status === 'active').map((s) => s.id);
      const staffIds = input.staffIds?.length ? input.staffIds.filter((id) => active.includes(id)) : active;
      if (input.staffIds?.length && !staffIds.length) throw new ApiError('validation', 'staffIds');
      if (input.enabled && !staffIds.length) throw new ApiError('intake_no_staff', 'Некому принимать');
      const existing = intakeServiceTx(businessId);
      const fields = { durationMin: input.slotMin, staffIds, active: input.enabled, onlineBookable: input.enabled };
      const svc = existing
        ? coreTx.update('services', existing.id, fields)
        : coreTx.create('services', {
            businessId,
            categoryId: '',
            sphereId: business.sphereIds[0] ?? 'general',
            name: { ...INTAKE_SERVICE_NAME },
            kind: 'intake',
            priceMin: 0,
            bufferAfterMin: 0,
            photos: [],
            materials: [],
            workplaces: ['salon'],
            order: 0,
            ...fields,
          });
      // ⭐ Выдача по времени (06.10.2026): «Выдача заказа» — то же окно и те же люди, включена вместе с приёмом
      syncPickupServiceTx({ businessId, sphereId: business.sphereIds[0] ?? 'general', durationMin: input.slotMin, staffIds, enabled: input.enabled });
      // Пара Service.staffIds ↔ Staff.serviceIds — её читают окна и проверка записи
      for (const s of staff) {
        const has = s.serviceIds.includes(svc.id);
        const should = staffIds.includes(s.id);
        if (has !== should) coreTx.update('staff', s.id, { serviceIds: should ? [...s.serviceIds, svc.id] : s.serviceIds.filter((x) => x !== svc.id) });
      }
      return intakeSettingsOf(svc);
    },
    { permission: 'settings.manage' },
  );
}

/** Записи на сдачу за день: кто придёт, что сдаёт, принят ли уже заказ */
export function listIntakeBookings(businessId: Id, date: ISODate): Promise<IntakeBooking[]> {
  if (isApiMode()) return S.listIntakeBookingsServer(businessId, date);
  return request(() => {
    const svc = intakeServiceTx(businessId);
    if (!svc) return [];
    const core = readCore();
    const orders = readArea('orders').orders.filter((o) => o.businessId === businessId && o.bookingId);
    return core.bookings
      .filter((b) => b.businessId === businessId && !b.deletedAt && b.start.slice(0, 10) === date && !INTAKE_CLOSED_STATUSES.includes(b.status) && isIntakeBooking(b, svc.id))
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((b) => {
        const client = b.clientId ? core.clients.find((c) => c.id === b.clientId) : undefined;
        const order = orders.find((o) => o.bookingId === b.id);
        return {
          bookingId: b.id,
          start: b.start,
          durationMin: b.durationMin,
          status: b.status,
          staffId: b.staffId,
          clientId: b.clientId ?? null,
          clientName: b.visitorName ?? client?.name ?? '',
          clientPhone: client?.phone ?? '',
          description: b.comment ?? null,
          orderId: order?.id ?? null,
          orderNumber: order?.number ?? null,
        };
      });
  });
}

/** Проверка записи перед «Принять заказ» (мок, внутри request): мастер и филиал записи — по умолчанию для заказа */
export function intakeBookingForOrderTx(businessId: Id, bookingId: Id): { staffId: Id; locationId: Id } {
  const booking = readCore().bookings.find((b) => b.id === bookingId && b.businessId === businessId);
  if (!booking || booking.deletedAt) throw new ApiError('not_found', 'Запись не найдена');
  if (!isIntakeBooking(booking, intakeServiceTx(businessId)?.id)) throw new ApiError('not_intake_booking', 'Это не запись на сдачу');
  if (INTAKE_CLOSED_STATUSES.includes(booking.status)) throw new ApiError('booking_cancelled', 'Запись отменена');
  if (readArea('orders').orders.some((o) => o.bookingId === bookingId)) throw new ApiError('intake_already_accepted', 'Заказ по этой записи уже принят');
  return { staffId: booking.staffId, locationId: booking.locationId };
}

/**
 * После «Принять заказ» по записи: клиент пришёл — запись на сдачу «Пришёл» тем же переходом, что в журнале (как сервер:
 * best-effort — переход не разрешён или нет прав, запись остаётся как была; заказ уже принят).
 */
export function markIntakeArrivedTx(bookingId: Id): void {
  const booking = readCore().bookings.find((b) => b.id === bookingId);
  if (!booking || booking.status === 'arrived' || INTAKE_CLOSED_STATUSES.includes(booking.status)) return;
  try {
    coreTx.changeBookingStatus(bookingId, 'arrived');
  } catch {
    // запись могли отметить иначе — заказ от этого не зависит
  }
}
