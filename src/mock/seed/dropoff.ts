import type { Booking, Service, Staff, WorkSchedule } from '@/domain/core';
import { INTAKE_SERVICE_NAME } from '@/domain/ordersIntake';
import { h, sameDays, week, type SeedClock } from '@/mock/seed/helpers';
import { BIZ, LOC, ST } from '@/mock/seed/ids';

/** Услуга «Приём заказа» FixPoint — постоянный id (демо и замеры) */
export const FIX_INTAKE_SERVICE_ID = 'sv_fix_intake';
/** Запись на сдачу, по которой уже принят заказ №1022 (срез orders) */
export const FIX_DROPOFF_ACCEPTED_BOOKING_ID = 'bk_fix_drop_1';

/**
 * ⭐ Запись на сдачу по времени (05.10.2026): у демо-мастерской FixPoint включена «Запись на сдачу» — окна по 15 минут,
 * принимают оба мастера по часам мастерской; в журнале — записи на сдачу сегодня и завтра (одна уже стала заказом №1022).
 * Шагом ПОСЛЕ основного сида и без ГПСЧ: остальные записи, люди и время в демо не сдвигаются (kind 'intake' сид
 * обычных записей и так не выбирает).
 */
export function addFixpointDropOff(clock: SeedClock, staff: Staff[], services: Service[], schedules: WorkSchedule[], bookings: Booking[]): void {
  const masters: string[] = [ST.fixTigran, ST.fixNarek];
  if (!staff.some((s) => s.id === ST.fixTigran)) return;
  services.push({
    id: FIX_INTAKE_SERVICE_ID,
    businessId: BIZ.fixpoint,
    categoryId: '',
    sphereId: 'repair',
    name: { ...INTAKE_SERVICE_NAME },
    kind: 'intake',
    durationMin: 15,
    priceMin: 0,
    bufferAfterMin: 0,
    photos: [],
    materials: [],
    staffIds: masters,
    workplaces: ['salon'],
    onlineBookable: true,
    active: true,
    order: 0,
  });
  for (const s of staff) if (masters.includes(s.id)) s.serviceIds = [...s.serviceIds, FIX_INTAKE_SERVICE_ID];
  // Часы мастерской (пн–пт 10–20, сб 11–18): мастера на месте — приём по времени возможен
  const hours = week({ ...sameDays([0, 1, 2, 3, 4], [h('10:00', '20:00')]), 5: [h('11:00', '18:00')] });
  masters.forEach((staffId, i) =>
    schedules.push({ id: `sch_fix_${i + 1}`, staffId, locationId: LOC.fixpoint, workplace: 'salon', week: hours, overrides: {}, openUntil: clock.day(30) }),
  );

  const plan: [id: string, offset: number, time: string, staffId: string, clientId: string, comment: string, status: Booking['status']][] = [
    [FIX_DROPOFF_ACCEPTED_BOOKING_ID, 0, '11:45', ST.fixNarek, 'cl_fix_03', 'Наушники AirPods Pro — хрип в левом', 'arrived'],
    ['bk_fix_drop_2', 0, '16:30', ST.fixTigran, 'cl_fix_05', 'MacBook Pro — не включается после обновления', 'scheduled'],
    ['bk_fix_drop_3', 0, '18:15', ST.fixNarek, 'cl_fix_06', 'Samsung Galaxy S23 — разбит задний корпус', 'client_confirmed'],
    ['bk_fix_drop_4', 1, '10:15', ST.fixTigran, 'cl_fix_07', 'iPad Air — не реагирует сенсор', 'scheduled'],
  ];
  for (const [id, offset, time, staffId, clientId, comment, status] of plan) {
    const createdAt = clock.at(offset - 1, '19:20');
    bookings.push({
      id,
      businessId: BIZ.fixpoint,
      locationId: LOC.fixpoint,
      staffId,
      clientId,
      start: clock.at(offset, time),
      durationMin: 15,
      status,
      services: [{ serviceId: FIX_INTAKE_SERVICE_ID, staffId, price: 0, durationMin: 15, qty: 1 }],
      total: 0,
      resourceIds: [],
      workplace: 'salon',
      source: 'link',
      createdBy: 'client',
      forWhom: 'self',
      comment,
      staffAssignment: 'any',
      createdAt,
      updatedAt: createdAt,
    });
  }
  bookings.sort((x, y) => x.start.localeCompare(y.start) || x.id.localeCompare(y.id));
}
