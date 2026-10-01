import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { freeSlots, planBooking, type PlaceBookingInput } from '@/domain/rules';
import { DAY, NOW, makeBooking, makeCore, makeStaff } from '@/domain/rules/tests/fixture';

const base: PlaceBookingInput = {
  source: 'app',
  businessId: 'biz_1',
  staffId: 'st_anna',
  start: `${DAY}T10:00`,
  services: [{ serviceId: 'sv_mani' }],
  client: { appUserId: 'au_1' },
};

const plan = (input: Partial<PlaceBookingInput>, core = makeCore(), ctx = {}) =>
  planBooking(core, { ...base, ...input }, { now: NOW, ...ctx });

describe('один поток записи (F-00-092, F-03-093)', () => {
  test('приложение: клиент по номеру приложения, статус «Записан», место из графика', () => {
    const r = plan({});
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.plan.client, { kind: 'existing', clientId: 'cl_1', setAppUserId: 'au_1' });
    assert.equal(r.plan.booking.status, 'scheduled');
    assert.equal(r.plan.booking.locationId, 'loc_1');
    assert.equal(r.plan.booking.workplace, 'salon');
    assert.equal(r.plan.booking.createdBy, 'client');
    assert.equal(r.plan.booking.appUserId, 'au_1');
  });
  test('новый пользователь приложения — карточка заводится', () => {
    const r = plan({ client: { appUserId: 'au_new' } });
    assert.ok(r.ok && r.plan.client.kind === 'new' && r.plan.client.client.phone === '+37400155555');
  });
  test('виджет: номер из формы, имя — на записи, карточку не трогает', () => {
    const r = plan({ source: 'widget', client: { phone: '0 00 133 333', name: 'Кара' } });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.plan.client, { kind: 'existing', clientId: 'cl_1' });
    assert.equal(r.plan.booking.visitorName, 'Кара');
    assert.equal(plan({ source: 'widget', client: { phone: '123' } }).ok, false);
  });
  test('«от–до»: бронирует верхнюю границу, цена — нижняя', () => {
    const r = plan({ services: [{ serviceId: 'sv_long' }] });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.plan.booking.durationMin, 90);
    assert.equal(r.plan.lines[0].price, 8000);
  });
  test('окно, которое показали, принимается; занятое — slot_taken', () => {
    const core = makeCore({ bookings: [makeBooking({ start: `${DAY}T10:00` })] });
    const shown = freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 60 }, NOW);
    assert.equal(plan({ start: shown[0].start }, core).ok, true);
    assert.deepEqual(plan({ start: `${DAY}T10:30` }, core), { ok: false, code: 'slot_taken' });
    // вне часов и в прошлом — онлайн тоже «окно уже заняли»
    assert.deepEqual(plan({ start: `${DAY}T13:30` }, core), { ok: false, code: 'slot_taken' });
  });
  test('запас после услуги учитывается (F-00-057)', () => {
    const core = makeCore({
      bookings: [makeBooking({ start: `${DAY}T10:00`, services: [{ serviceId: 'sv_long', staffId: 'st_anna', price: 8000, durationMin: 60, qty: 1 }] })],
    });
    assert.equal(plan({ start: `${DAY}T11:00` }, core).ok, false);
    assert.equal(plan({ start: `${DAY}T11:15` }, core).ok, true);
  });
  test('журнал: вне часов можно, двойную запись — нельзя, статус от сотрудника', () => {
    const core = makeCore({ bookings: [makeBooking({ start: `${DAY}T10:00` })] });
    const j = { source: 'journal' as const, client: { clientId: 'cl_1' }, createdBy: 'st_owner' };
    const late = plan({ ...j, start: `${DAY}T20:00` }, core);
    assert.ok(late.ok && late.plan.booking.status === 'scheduled' && late.plan.booking.createdBy === 'st_owner');
    assert.deepEqual(plan({ ...j, start: `${DAY}T10:30` }, core), { ok: false, code: 'slot_taken' });
    const past = plan({ ...j, start: '2026-09-29T10:00', status: 'arrived' }, core);
    assert.ok(past.ok && past.plan.booking.status === 'arrived');
    // журнал может без клиента (F-01-039), онлайн — нет
    assert.equal(plan({ ...j, client: undefined, start: `${DAY}T12:00` }, core).ok, true);
    assert.deepEqual(plan({ client: undefined }, core), { ok: false, code: 'client_required' });
  });
  test('выезд — всегда подтверждение; предоплата — со сроком', () => {
    const visit = plan({ workplace: 'visit' });
    assert.ok(visit.ok && visit.plan.booking.status === 'awaiting_confirmation');
    const core = makeCore({ staff: [makeStaff({ prepayment: { amount: 3000, timeoutMin: 20, requisites: 'Idram' } })] });
    const r = plan({}, core);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.plan.booking.status, 'awaiting_prepayment');
    assert.deepEqual(r.plan.booking.prepayment, { amount: 3000, paid: false, holdUntil: '2026-09-30T12:20' });
  });
  test('онлайн-запреты: блок, «кого принимаю», выключено, модерация, пауза', () => {
    assert.deepEqual(plan({ source: 'widget', client: { phone: '+37400144444' } }), { ok: false, code: 'client_blocked' });
    const women = makeCore({ staff: [makeStaff({ accepts: 'women' })] });
    assert.deepEqual(plan({ client: { appUserId: 'au_new' } }, women), { ok: false, code: 'accepts_mismatch' });
    const off = makeCore({ staff: [makeStaff({ onlineBookingEnabled: false })] });
    assert.deepEqual(plan({}, off), { ok: false, code: 'online_disabled' });
    assert.deepEqual(plan({}, makeCore(), { hiddenIds: new Set(['st_anna']) }), { ok: false, code: 'staff_hidden' });
    assert.deepEqual(plan({}, makeCore(), { pauseUntil: DAY }), { ok: false, code: 'online_paused' });
    const notOnline = makeCore();
    notOnline.services[0].onlineBookable = false;
    assert.deepEqual(plan({}, notOnline), { ok: false, code: 'service_unavailable' });
    // журналу это не мешает
    assert.equal(plan({ source: 'journal', client: { clientId: 'cl_1' } }, notOnline).ok, true);
  });
  test('«Только мои клиенты»: чужой — заявка, свой — сразу', () => {
    const core = makeCore({
      staff: [makeStaff({ calendarVisibility: 'mine' })],
      bookings: [makeBooking({ id: 'old', start: '2026-09-01T10:00', status: 'arrived', clientId: 'cl_1', appUserId: 'au_1' })],
    });
    const own = plan({}, core);
    assert.ok(own.ok && own.plan.booking.status === 'scheduled');
    const stranger = plan({ client: { appUserId: 'au_new' } }, core);
    assert.ok(stranger.ok && stranger.plan.booking.status === 'awaiting_confirmation');
  });
  test('групповое событие: места считаются', () => {
    const core = makeCore({
      groupEvents: [
        { id: 'ev1', businessId: 'biz_1', locationId: 'loc_1', serviceId: 'sv_group', staffId: 'st_anna', start: `${DAY}T16:00`, durationMin: 90, capacity: 2, resourceIds: [], status: 'scheduled', createdAt: NOW },
      ],
      bookings: [makeBooking({ id: 'g1', start: `${DAY}T16:00`, groupEventId: 'ev1', durationMin: 90 })],
    });
    const r = plan({ groupEventId: 'ev1', services: [{ serviceId: 'sv_group' }] }, core);
    assert.ok(r.ok && r.plan.booking.start === `${DAY}T16:00` && r.plan.booking.durationMin === 90);
    assert.deepEqual(plan({ groupEventId: 'ev1', services: [{ serviceId: 'sv_group', qty: 2 }] }, core), { ok: false, code: 'group_full' });
  });
});

describe('правила слотов schedule и просроченная предоплата', () => {
  test('онлайн: начало, которого schedule не предлагал, — slot_taken; журнал не спрашивает', () => {
    const never = () => false;
    assert.deepEqual(planBooking(makeCore(), base, { now: NOW, isStartOffered: never }), { ok: false, code: 'slot_taken' });
    const j: PlaceBookingInput = { ...base, source: 'journal', client: { clientId: 'cl_1' } };
    assert.equal(planBooking(makeCore(), j, { now: NOW, isStartOffered: never }).ok, true);
  });
  test('«ждёт предоплату» с истёкшим сроком время не держит (F-02-071)', () => {
    const core = makeCore({
      bookings: [makeBooking({ status: 'awaiting_prepayment', start: `${DAY}T10:00`, prepayment: { amount: 3000, paid: false, holdUntil: '2026-09-30T11:00' } })],
    });
    assert.equal(plan({}, core).ok, true);
    const fresh = makeCore({
      bookings: [makeBooking({ status: 'awaiting_prepayment', start: `${DAY}T10:00`, prepayment: { amount: 3000, paid: false, holdUntil: '2026-09-30T12:30' } })],
    });
    assert.deepEqual(plan({}, fresh), { ok: false, code: 'slot_taken' });
  });
  test('после openUntil окон нет (F-00-055)', () => {
    const core = makeCore({ schedules: [{ ...makeCore().schedules[0], openUntil: '2026-09-30' }] });
    assert.deepEqual(plan({}, core), { ok: false, code: 'slot_taken' });
  });
});
