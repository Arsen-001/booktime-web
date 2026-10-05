import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkSlot, homeShiftConflict, planBooking } from '@/domain/rules';
import type { CoreData } from '@/domain/core';
import { DAY, NOW, makeCore, makeSchedule, makeStaff } from '@/domain/rules/tests/fixture';

/**
 * F-00-047: мастер салона Анна (смена 10–14, 15–19) ещё и сама по себе — карточка st_anna_own в своём бизнесе biz_own
 * (тот же номер, домашний график 08–22). Галочка владельца салона — Business.forbidHomeBookingsDuringShift.
 */
function dualCore(forbid: boolean): CoreData {
  const base = makeCore();
  const HOME = [{ from: '08:00', to: '22:00' }];
  return {
    ...base,
    businesses: [
      { ...base.businesses[0], forbidHomeBookingsDuringShift: forbid },
      { ...base.businesses[0], id: 'biz_own', kind: 'individual', slug: 'anna', name: 'Анна', ownerStaffId: 'st_anna_own', forbidHomeBookingsDuringShift: false },
    ],
    staff: [...base.staff, makeStaff({ id: 'st_anna_own', businessId: 'biz_own', workplaces: ['home'] })],
    schedules: [
      makeSchedule(),
      makeSchedule({ id: 'sch_own', staffId: 'st_anna_own', workplace: 'home', week: { 0: HOME, 1: HOME, 2: HOME, 3: HOME, 4: HOME, 5: HOME, 6: HOME } }),
    ],
  };
}

describe('домашняя запись в часы смены (F-00-047)', () => {
  test('галочка стоит: домашняя запись в своём бизнесе на смене в салоне — нельзя', () => {
    const core = dualCore(true);
    assert.deepEqual(homeShiftConflict(core, { staffId: 'st_anna_own', start: `${DAY}T13:30`, durationMin: 60, workplace: 'home' }), {
      businessId: 'biz_1',
      staffId: 'st_anna',
      from: '10:00',
      to: '14:00',
    });
    const slot = checkSlot(core, { staffId: 'st_anna_own', start: `${DAY}T11:00`, durationMin: 60, workplace: 'home' }, NOW);
    assert.deepEqual(slot, { ok: false, reason: 'home_during_shift' });
  });

  test('в перерыве смены, после смены, выезд в перерыв — можно; выезд на смену — нельзя', () => {
    const core = dualCore(true);
    assert.equal(homeShiftConflict(core, { staffId: 'st_anna_own', start: `${DAY}T14:00`, durationMin: 60, workplace: 'home' }), null);
    assert.equal(homeShiftConflict(core, { staffId: 'st_anna_own', start: `${DAY}T19:00`, durationMin: 90, workplace: 'home' }), null);
    assert.ok(homeShiftConflict(core, { staffId: 'st_anna_own', start: `${DAY}T16:00`, durationMin: 30, workplace: 'visit' }));
    assert.equal(checkSlot(core, { staffId: 'st_anna_own', start: `${DAY}T19:30`, durationMin: 60, workplace: 'home' }, NOW).ok, true);
  });

  test('галочки нет или запись в салоне — правило не действует', () => {
    assert.equal(homeShiftConflict(dualCore(false), { staffId: 'st_anna_own', start: `${DAY}T11:00`, durationMin: 60, workplace: 'home' }), null);
    assert.equal(homeShiftConflict(dualCore(true), { staffId: 'st_anna', start: `${DAY}T11:00`, durationMin: 60, workplace: 'salon' }), null);
  });

  test('уволенная карточка в салоне смены не даёт', () => {
    const core = dualCore(true);
    const fired = { ...core, staff: core.staff.map((s) => (s.id === 'st_anna' ? { ...s, status: 'fired' as const } : s)) };
    assert.equal(homeShiftConflict(fired, { staffId: 'st_anna_own', start: `${DAY}T11:00`, durationMin: 60, workplace: 'home' }), null);
  });

  test('единый поток записи отвечает понятной ошибкой home_during_shift', () => {
    const core = dualCore(true);
    const ownService = { ...core.services[0], id: 'sv_own', businessId: 'biz_own', staffIds: ['st_anna_own'], workplaces: ['home' as const] };
    const res = planBooking(
      { ...core, services: [...core.services, ownService] },
      { businessId: 'biz_own', staffId: 'st_anna_own', start: `${DAY}T11:00`, services: [{ serviceId: 'sv_own' }], workplace: 'home', source: 'journal', client: { phone: '+37400155555', name: 'Лия' } },
      { now: NOW },
    );
    assert.deepEqual(res, { ok: false, code: 'home_during_shift' });
  });
});
