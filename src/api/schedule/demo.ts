'use client';

/** «Проверить на реальных данных» (F-02-072): сотрудники с онлайн-услугами и учебная запись, которая занимает окно */
import { ApiError, request } from '@/api/request';
import { readCore } from '@/api/area';
import { coreTx } from '@/api/core';
import { isApiMode } from '@/api/http';
import * as J from '@/api/journal.server';
import * as St from '@/api/staff.server';
import * as Sv from '@/api/services.server';
import * as Rs from '@/api/resources.server';
import { occupiesTime } from '@/domain/rules';
import type { ISODateTime, Id, LocalizedText, Minutes, Workplace } from '@/domain/core';
import { nowDateTime, today } from '@/lib/date';

/** Пометка учебной записи — отличить от записей клиентов */
const DEMO_MARK = '__live-demo__';

export interface LiveDemoService {
  id: Id;
  name: LocalizedText;
  durationMin: Minutes;
  durationMax?: Minutes;
  bufferAfterMin: Minutes;
  resource?: { name: LocalizedText; count: number };
}

export interface LiveDemoStaff {
  id: Id;
  name: string;
  services: LiveDemoService[];
}

/** Сотрудники филиала с онлайн-записью и их услуги (L-2: по умолчанию — первый, у кого есть такие услуги) */
export function getLiveDemoOptions(businessId: Id, locationId: Id): Promise<LiveDemoStaff[]> {
  if (isApiMode()) return apiGetLiveDemoOptions(businessId, locationId);
  return request(() => {
    const core = readCore();
    return core.staff
      .filter(
        (s) =>
          s.businessId === businessId && s.locationIds.includes(locationId) && s.status === 'active' && s.onlineBookingEnabled !== false,
      )
      .map((s) => ({
        id: s.id,
        name: s.name,
        services: core.services
          .filter((sv) => sv.businessId === businessId && sv.active && sv.onlineBookable && sv.staffIds.includes(s.id))
          .map((sv) => {
            const res = core.resources.find((r) => r.active && r.locationId === locationId && r.serviceIds.includes(sv.id));
            return {
              id: sv.id,
              name: sv.name,
              durationMin: sv.durationMin,
              durationMax: sv.durationMax,
              bufferAfterMin: sv.bufferAfterMin ?? 0,
              ...(res ? { resource: { name: res.name, count: res.instances.length } } : {}),
            };
          }),
      }))
      .sort((a, b) => (b.services.length > 0 ? 1 : 0) - (a.services.length > 0 ? 1 : 0));
  });
}

async function apiGetLiveDemoOptions(businessId: Id, locationId: Id): Promise<LiveDemoStaff[]> {
  const [staffRows, services, resources] = await Promise.all([St.listStaff(businessId), Sv.listServices(businessId), Rs.listResources(businessId)]);
  return staffRows
    .map((r) => r.staff)
    .filter((s) => s.locationIds.includes(locationId) && s.status === 'active' && s.onlineBookingEnabled !== false)
    .map((s) => ({
      id: s.id,
      name: s.name,
      services: services
        .filter((sv) => sv.active && sv.onlineBookable && sv.staffIds.includes(s.id))
        .map((sv) => {
          const res = resources.find((r) => r.active && r.locationId === locationId && r.serviceIds.includes(sv.id));
          return {
            id: sv.id,
            name: sv.name,
            durationMin: sv.durationMin,
            durationMax: sv.durationMax,
            bufferAfterMin: sv.bufferAfterMin ?? 0,
            ...(res ? { resource: { name: res.name, count: res.instances.length } } : {}),
          };
        }),
    }))
    .sort((a, b) => (b.services.length > 0 ? 1 : 0) - (a.services.length > 0 ? 1 : 0));
}

export function getDemoBooking(staffId: Id): Promise<{ id: Id; start: ISODateTime } | undefined> {
  if (isApiMode()) return apiGetDemoBooking(staffId);
  return request(() => {
    const b = readCore().bookings.find((x) => x.staffId === staffId && x.comment === DEMO_MARK && occupiesTime(x));
    return b ? { id: b.id, start: b.start } : undefined;
  });
}

/** Учебная запись создаётся и сразу проверяется на этом же экране — «от сегодня» вперёд достаточно и дёшево */
async function apiGetDemoBooking(staffId: Id): Promise<{ id: Id; start: ISODateTime } | undefined> {
  const businessId = St.bizOf(staffId);
  const list = await J.listBookings({ businessId, staffId, from: today() });
  const b = list.find((x) => x.comment === DEMO_MARK && occupiesTime(x));
  return b ? { id: b.id, start: b.start } : undefined;
}

/** Занять окно учебной записью — окно сразу пропадает из свободных (F-02-072). Один запрос. */
export function bookDemoSlot(input: {
  businessId: Id;
  locationId: Id;
  staffId: Id;
  serviceId: Id;
  start: ISODateTime;
  workplace: Workplace;
}): Promise<void> {
  // Режим api (этап 7): учебная запись — обычная запись на сервере (замок на мастера), окно пропадает у всех
  if (isApiMode()) return apiBookDemoSlot(input);
  return request(() => {
    const svc = readCore().services.find((s) => s.id === input.serviceId);
    if (!svc) throw new ApiError('not_found');
    coreTx.createBooking({
      businessId: input.businessId,
      locationId: input.locationId,
      staffId: input.staffId,
      start: input.start,
      status: 'scheduled',
      services: [
        {
          serviceId: svc.id,
          staffId: input.staffId,
          price: 0,
          durationMin: svc.durationMax ?? svc.durationMin,
          qty: 1,
        },
      ],
      resourceIds: [],
      workplace: input.workplace,
      source: 'journal',
      createdBy: input.staffId,
      forWhom: 'self',
      comment: DEMO_MARK,
    });
  });
}

/** Отменить учебную запись — окно возвращается в свободные в тот же момент */
export function cancelDemoSlot(bookingId: Id): Promise<void> {
  if (isApiMode()) return J.removeBooking(bookingId).then(() => undefined);
  return request(() => {
    coreTx.updateBooking(bookingId, { deletedAt: nowDateTime() });
  });
}

async function apiBookDemoSlot(input: { businessId: Id; locationId: Id; staffId: Id; serviceId: Id; start: ISODateTime; workplace: Workplace }): Promise<void> {
  const durationMin = await request(() => {
    const svc = readCore().services.find((s) => s.id === input.serviceId);
    if (!svc) throw new ApiError('not_found');
    return svc.durationMax ?? svc.durationMin;
  });
  await J.createBooking({
    businessId: input.businessId,
    locationId: input.locationId,
    staffId: input.staffId,
    start: input.start,
    status: 'scheduled',
    services: [{ serviceId: input.serviceId, staffId: input.staffId, price: 0, durationMin, qty: 1 }],
    resourceIds: [],
    workplace: input.workplace,
    source: 'journal',
    createdBy: input.staffId,
    forWhom: 'self',
    comment: DEMO_MARK,
  });
}
