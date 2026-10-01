import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  computeWaitlistStatus,
  draftsToWishes,
  filterWaitlist,
  findSameWaitlistRequest,
  waitlistDayOf,
  waitlistFromLegacyApp,
  waitlistFromLegacyJournal,
  waitlistFromLegacyWidget,
  wishesForDay,
  waitlistWantsSlot,
  wishesToDrafts,
  type WaitlistEntry,
} from '@/domain/resources';

// Один лист ожидания бизнеса (владелец, 30.09.2026): экран /biz/waitlist и панель журнала — одни правила
const TODAY = '2026-09-30';
const entry = (over: Partial<WaitlistEntry>): WaitlistEntry => ({
  id: 'wl1',
  businessId: 'b1',
  locationId: 'l1',
  clientName: 'Анна Симонян',
  clientPhone: '+37400111222',
  serviceIds: ['s1'],
  staffIds: [],
  wishes: [],
  tags: [],
  createdAt: '2026-09-29T10:00',
  ...over,
});

describe('лист ожидания: перенос старых заявок журнала', () => {
  test('слоты → желания, bookingId → closedBookingId, пустой комментарий не хранится', () => {
    const e = waitlistFromLegacyJournal({
      id: 'wl_old',
      businessId: 'b1',
      locationId: 'l1',
      clientName: 'Мариам',
      clientPhone: '+37400111333',
      serviceIds: ['s1'],
      staffIds: ['st1'],
      slots: [
        { date: '2026-10-02', anyTime: true, intervals: [] },
        { date: '2026-10-03', anyTime: false, intervals: [{ from: '10:00', to: '12:00' }] },
        { anyTime: false, intervals: [{ from: '18:00', to: '20:00' }] },
        { anyTime: true, intervals: [] },
      ],
      comment: '',
      bookingId: 'bk1',
      createdAt: '2026-09-28T09:00',
    });
    assert.deepEqual(e.wishes, [
      { date: '2026-10-02' },
      { date: '2026-10-03', time: '10:00', intervals: [{ from: '10:00', to: '12:00' }] },
      { time: '18:00', intervals: [{ from: '18:00', to: '20:00' }] },
    ]);
    assert.equal(e.closedBookingId, 'bk1');
    assert.equal(e.comment, undefined);
    assert.deepEqual(e.tags, []);
    assert.equal(computeWaitlistStatus(e, TODAY), 'closed');
  });
  test('битая старая заявка без списков не роняет перенос', () => {
    const e = waitlistFromLegacyJournal({ id: 'x', businessId: 'b1', locationId: '', clientName: '', clientPhone: '', createdAt: '' });
    assert.deepEqual([e.serviceIds, e.staffIds, e.wishes], [[], [], []]);
    assert.equal(computeWaitlistStatus(e, TODAY), 'active');
  });
});

describe('лист ожидания: форма желаний', () => {
  test('черновик ↔ желания без потерь; «любой день, любое время» = ждёт когда угодно', () => {
    const wishes = [{ date: '2026-10-02' }, { date: '2026-10-03', time: '10:00', intervals: [{ from: '10:00', to: '12:00' }] }, { time: '18:00', intervals: [{ from: '18:00', to: '20:00' }] }];
    assert.deepEqual(draftsToWishes(wishesToDrafts(wishes)), wishes);
    assert.deepEqual(draftsToWishes([{ anyTime: true, intervals: [] }]), []);
    assert.deepEqual(wishesToDrafts([]), [{ anyTime: true, intervals: [] }]);
  });
});

describe('лист ожидания: фильтр и окно', () => {
  const list = [
    entry({ id: 'a', wishes: [{ date: '2026-10-02' }], createdAt: '2026-09-29T10:00' }),
    entry({ id: 'b', wishes: [{ time: '18:00', intervals: [{ from: '18:00', to: '20:00' }] }], createdAt: '2026-09-29T11:00' }),
    entry({ id: 'c', wishes: [{ date: '2026-09-28' }], createdAt: '2026-09-27T10:00' }),
    entry({ id: 'd', clientName: 'Гоар', clientPhone: '+37400999888', wishes: [{ date: '2026-10-01' }], closedBookingId: 'bk' }),
  ];
  test('статус, день (заявка без даты подходит любому дню), сортировка «ближайшие», поиск', () => {
    assert.deepEqual(filterWaitlist(list, {}, TODAY).map((r) => r.id), ['a', 'b']);
    assert.deepEqual(filterWaitlist(list, { dateMode: 'selected', selectedDate: '2026-10-05' }, TODAY).map((r) => r.id), ['b']);
    assert.deepEqual(filterWaitlist(list, { status: 'expired' }, TODAY).map((r) => r.id), ['c']);
    assert.deepEqual(filterWaitlist(list, { status: 'all', query: '999' }, TODAY).map((r) => r.id), ['d']);
    assert.deepEqual(filterWaitlist(list, { status: 'all', query: 'гоар' }, TODAY).map((r) => r.id), ['d']);
  });
  test('«Предложить окно» доходит до заявки: услуга, мастер «любой», интервал [from; to)', () => {
    const t = { businessId: 'b1', staffId: 'st1', serviceId: 's1', date: '2026-10-04', time: '18:30' };
    assert.equal(waitlistWantsSlot(list[1], t, TODAY), true);
    assert.equal(waitlistWantsSlot(list[1], { ...t, time: '20:00' }, TODAY), false);
    assert.equal(waitlistWantsSlot(list[0], t, TODAY), false);
    assert.equal(waitlistWantsSlot(list[0], { ...t, date: '2026-10-02' }, TODAY), true);
    assert.equal(waitlistWantsSlot(list[3], { ...t, date: '2026-10-01' }, TODAY), false);
    assert.equal(waitlistWantsSlot(entry({ staffIds: ['st2'] }), t, TODAY), false);
  });
});

describe('лист ожидания: входы клиента (приложение, виджет) пишут в тот же лист', () => {
  test('день клиента ↔ желания: «любой день» — пустой список, обратно — тот же день', () => {
    assert.deepEqual(wishesForDay('any'), []);
    assert.deepEqual(wishesForDay('2026-10-03'), [{ date: '2026-10-03' }]);
    assert.equal(waitlistDayOf({ wishes: [{ date: '2026-10-03' }] }), '2026-10-03');
    assert.equal(waitlistDayOf({ wishes: [] }), 'any');
    // Заявка с несколькими днями (сотрудник поправил) — в приложении «любой день», не первый попавшийся
    assert.equal(waitlistDayOf({ wishes: [{ date: '2026-10-03' }, { date: '2026-10-04' }] }), 'any');
  });
  test('второй раз на то же не встать: по пользователю приложения или телефону, только активная и на этот день', () => {
    const list = [
      entry({ id: 'app', appUserId: 'au1', staffIds: ['st1'], wishes: [{ date: '2026-10-03' }] }),
      entry({ id: 'any', clientPhone: '+37400111333', staffIds: [], wishes: [] }),
      entry({ id: 'closed', clientPhone: '+37400111444', wishes: [{ date: '2026-10-03' }], closedBookingId: 'bk' }),
    ];
    const q = { businessId: 'b1', staffId: 'st1', serviceId: 's1', date: '2026-10-03' as const };
    assert.equal(findSameWaitlistRequest(list, { ...q, appUserId: 'au1' }, TODAY)?.id, 'app');
    assert.equal(findSameWaitlistRequest(list, { ...q, appUserId: 'au1', date: '2026-10-04' }, TODAY), undefined);
    assert.equal(findSameWaitlistRequest(list, { ...q, phone: '+37400111333' }, TODAY)?.id, 'any');
    assert.equal(findSameWaitlistRequest(list, { ...q, phone: '+37400111444' }, TODAY), undefined);
    assert.equal(findSameWaitlistRequest(list, { ...q, phone: '+37400111333', serviceId: 's2' }, TODAY), undefined);
  });
  test('перенос старых заявок приложения и виджета: источник, мастер, услуга, день; отменённые виджета — нет', () => {
    const app = waitlistFromLegacyApp(
      { id: 'wl_a', appUserId: 'au1', staffId: 'st1', serviceId: 's1', date: 'any', createdAt: '2026-09-29T09:00' },
      { businessId: 'b1', locationId: 'l1', clientName: 'Лусине', clientPhone: '+37400100101' },
    );
    assert.equal(app.source, 'app');
    assert.equal(app.appUserId, 'au1');
    assert.deepEqual([app.serviceIds, app.staffIds, app.wishes], [['s1'], ['st1'], []]);
    const widget = { id: 'wl_w', businessId: 'b1', staffId: 'st1', serviceId: 's1', date: '2026-10-03', clientName: 'Арам', clientPhone: '+37400100202', createdAt: '2026-09-29T09:00' };
    const moved = waitlistFromLegacyWidget({ ...widget, comment: ' после 18 ', status: 'notified' });
    assert.equal(moved?.source, 'widget');
    assert.equal(moved?.locationId, '');
    assert.equal(moved?.comment, 'после 18');
    assert.deepEqual(moved?.wishes, [{ date: '2026-10-03' }]);
    assert.equal(waitlistFromLegacyWidget({ ...widget, status: 'cancelled' }), undefined);
    assert.equal(waitlistFromLegacyWidget({ ...widget, status: 'booked' }), undefined);
  });
});
