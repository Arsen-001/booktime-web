/**
 * Маленькая база ядра для тестов правил: один салон, два мастера, три услуги, график пн–вс 10:00–19:00
 * с перерывом 14:00–15:00. Дата теста — 2026-10-01 (четверг), «сейчас» — 2026-09-30T12:00.
 */
import type { Booking, CoreData, Service, Staff, WorkSchedule } from '@/domain/core';

export const DAY = '2026-10-01';
export const NOW = '2026-09-30T12:00';

const HOURS = [
  { from: '10:00', to: '14:00' },
  { from: '15:00', to: '19:00' },
];

export function makeStaff(patch: Partial<Staff> = {}): Staff {
  return {
    id: 'st_anna',
    businessId: 'biz_1',
    locationIds: ['loc_1'],
    name: 'Анна',
    phone: '+37400111111',
    role: 'master',
    sphereIds: ['nails'],
    photos: ['p1'],
    materials: [],
    workplaces: ['salon'],
    accepts: 'all',
    calendarVisibility: 'all',
    calendarMode: 'free',
    confirmMode: 'instant',
    colorIndex: 1,
    serviceIds: ['sv_mani', 'sv_long', 'sv_group'],
    status: 'active',
    hiredAt: '2025-01-01',
    login: 'anna.admin',
    homeAddress: 'ул. Абовяна 1, кв. 5',
    homeDistrict: 'kentron',
    ...patch,
  };
}

export function makeService(patch: Partial<Service> = {}): Service {
  return {
    id: 'sv_mani',
    businessId: 'biz_1',
    categoryId: 'cat_1',
    sphereId: 'nails',
    name: { ru: 'Маникюр' },
    kind: 'individual',
    durationMin: 60,
    priceMin: 5000,
    photos: [],
    materials: [],
    staffIds: ['st_anna'],
    workplaces: ['salon'],
    onlineBookable: true,
    active: true,
    order: 1,
    ...patch,
  };
}

export function makeSchedule(patch: Partial<WorkSchedule> = {}): WorkSchedule {
  return {
    id: 'sch_anna',
    staffId: 'st_anna',
    locationId: 'loc_1',
    workplace: 'salon',
    week: { 0: HOURS, 1: HOURS, 2: HOURS, 3: HOURS, 4: HOURS, 5: HOURS, 6: HOURS },
    overrides: {},
    ...patch,
  };
}

export function makeBooking(patch: Partial<Booking> = {}): Booking {
  return {
    id: 'bk_1',
    businessId: 'biz_1',
    locationId: 'loc_1',
    staffId: 'st_anna',
    start: `${DAY}T11:00`,
    durationMin: 60,
    status: 'scheduled',
    services: [{ serviceId: 'sv_mani', staffId: 'st_anna', price: 5000, durationMin: 60, qty: 1 }],
    total: 5000,
    resourceIds: [],
    workplace: 'salon',
    source: 'journal',
    createdBy: 'st_owner',
    forWhom: 'self',
    createdAt: '2026-09-20T10:00',
    updatedAt: '2026-09-20T10:00',
    ...patch,
  };
}

export function makeCore(patch: Partial<CoreData> = {}): CoreData {
  return {
    networks: [],
    businesses: [
      {
        id: 'biz_1',
        kind: 'salon',
        name: 'Нури',
        slug: 'nuri',
        sphereIds: ['nails'],
        ownerStaffId: 'st_owner',
        locationIds: ['loc_1'],
        phone: '+37400100000',
        photos: [],
        status: 'active',
        createdAt: '2025-01-01T10:00',
      },
    ],
    locations: [
      { id: 'loc_1', businessId: 'biz_1', name: { ru: 'Центр' }, address: { ru: 'Абовяна 10' }, district: 'kentron' },
    ],
    staff: [makeStaff(), makeStaff({ id: 'st_owner', name: 'Ова', phone: '+37400122222', role: 'owner' })],
    serviceCategories: [],
    services: [
      makeService(),
      makeService({ id: 'sv_long', name: { ru: 'Наращивание' }, durationMin: 60, durationMax: 90, priceMin: 8000, priceMax: 12000, bufferAfterMin: 15 }),
      makeService({ id: 'sv_group', name: { ru: 'Мастер-класс' }, kind: 'group', capacity: 2 }),
    ],
    resources: [],
    clients: [
      { id: 'cl_1', businessId: 'biz_1', phone: '+37400133333', name: 'Карина', gender: 'female', tags: [], noShowCount: 0, createdAt: '2026-01-01T10:00' },
      { id: 'cl_blocked', businessId: 'biz_1', phone: '+37400144444', name: 'Блок', gender: 'unknown', tags: [], noShowCount: 3, blocked: true, createdAt: '2026-01-01T10:00' },
    ],
    appUsers: [
      { id: 'au_1', phone: '+37400133333', name: 'Карина А.', gender: 'female', locale: 'ru', createdAt: '2026-02-01T10:00' },
      { id: 'au_new', phone: '+37400155555', name: 'Давид', gender: 'male', locale: 'hy', createdAt: '2026-02-01T10:00' },
    ],
    bookings: [],
    groupEvents: [],
    schedules: [makeSchedule()],
    calendarMarks: [],
    ...patch,
  };
}
