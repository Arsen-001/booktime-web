import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  newBookingStatus,
  noShowPeriodStart,
  normalizeNoShowRule,
  planBooking,
  prepaymentForEveryone,
  prepaymentNeed,
  recentNoShows,
  rescheduledStatus,
  type PlaceBookingInput,
} from '@/domain/rules';
import type { PrepaymentRule } from '@/domain/core';
import { DAY, NOW, makeBooking, makeCore, makeStaff } from '@/domain/rules/tests/fixture';

const riskRule: PrepaymentRule = { amount: 0, percent: 30, timeoutMin: 30, requisites: 'Idram', onlyAfterNoShows: { count: 2, months: 12 } };

const missed = (id: string, start: string, patch = {}) => makeBooking({ id, start, status: 'no_show', clientId: 'cl_1', ...patch });

describe('⭐ предоплата для тех, кто не приходил (владелец, 01.10.2026)', () => {
  test('период «последние M месяцев» — с концом месяца', () => {
    assert.equal(noShowPeriodStart('2026-09-30T12:00', 12), '2025-09-30T12:00');
    assert.equal(noShowPeriodStart('2026-03-31T09:00', 1), '2026-02-28T09:00');
    assert.equal(noShowPeriodStart('2026-01-15T09:00', 2), '2025-11-15T09:00');
  });
  test('порог приводится к пределам, по умолчанию 2 за 12', () => {
    assert.deepEqual(normalizeNoShowRule(undefined), { count: 2, months: 12 });
    assert.deepEqual(normalizeNoShowRule({ count: 0, months: 99 }), { count: 1, months: 24 });
  });
  test('счётчик — только у этого мастера, только за период; поздняя отмена считается', () => {
    const bookings = [
      missed('b1', '2026-08-01T10:00'),
      missed('b2', '2026-05-01T10:00', { status: 'cancelled_by_client', cancelledLate: true }),
      missed('b3', '2025-01-01T10:00'), // старше 12 месяцев
      missed('b4', '2026-07-01T10:00', { staffId: 'st_owner' }), // другой мастер (В-07)
      missed('b5', '2026-07-02T10:00', { status: 'cancelled_by_client' }), // отменил вовремя
      missed('b6', '2026-07-03T10:00', { deletedAt: '2026-07-04T10:00' }),
    ];
    assert.equal(recentNoShows(bookings, { staffId: 'st_anna', clientId: 'cl_1', now: NOW, months: 12 }), 2);
    assert.equal(recentNoShows(bookings, { staffId: 'st_owner', clientId: 'cl_1', now: NOW, months: 12 }), 1);
    assert.equal(recentNoShows(bookings, { staffId: 'st_anna', now: NOW, months: 12 }), 0);
  });
  test('нужна ли предоплата: всем / по порогу / выключено', () => {
    assert.deepEqual(prepaymentNeed({ amount: 0, percent: 30 }), { reason: 'all' });
    assert.equal(prepaymentNeed(riskRule, 1), undefined);
    assert.deepEqual(prepaymentNeed(riskRule, 2), { reason: 'no_shows', noShows: 2, count: 2, months: 12 });
    assert.equal(prepaymentNeed(undefined, 5), undefined);
    assert.equal(prepaymentForEveryone(riskRule), false);
    assert.equal(prepaymentForEveryone({ amount: 0, percent: 30 }), true);
  });
  test('статус новой записи: «ждёт предоплату» только у того, кто не приходил; журнал — без предоплаты', () => {
    const staff = makeStaff({ prepayment: riskRule, confirmMode: 'instant' });
    assert.equal(newBookingStatus({ source: 'app', staff, workplace: 'salon', clientNoShows: 0 }), 'scheduled');
    assert.equal(newBookingStatus({ source: 'widget', staff, workplace: 'salon', clientNoShows: 2 }), 'awaiting_prepayment');
    assert.equal(newBookingStatus({ source: 'journal', staff, workplace: 'salon', clientNoShows: 5 }), 'scheduled');
  });
  test('перенос не снимает предоплату «за то, что не приходил»', () => {
    const staff = makeStaff({ prepayment: riskRule, confirmMode: 'instant' });
    const b = makeBooking({ source: 'app', prepayment: { amount: 1500, paid: false, reason: 'no_shows', noShows: 2, months: 12 } });
    assert.equal(rescheduledStatus(b, staff), 'awaiting_prepayment');
    assert.equal(rescheduledStatus({ ...b, prepayment: { ...b.prepayment!, paid: true } }, staff), 'scheduled');
  });
  test('planBooking: запись онлайн несёт причину и сумму; без пропусков — обычная', () => {
    const input: PlaceBookingInput = {
      source: 'app',
      businessId: 'biz_1',
      staffId: 'st_anna',
      start: `${DAY}T10:00`,
      services: [{ serviceId: 'sv_mani' }],
      client: { appUserId: 'au_1' },
    };
    const staff = [makeStaff({ prepayment: riskRule, confirmMode: 'instant' }), makeStaff({ id: 'st_owner', name: 'Ова', phone: '+37400122222', role: 'owner' })];
    const clean = planBooking(makeCore({ staff }), input, { now: NOW });
    assert.ok(clean.ok && clean.plan.booking.status === 'scheduled' && !clean.plan.booking.prepayment);

    const history = [missed('b1', '2026-08-01T10:00', { appUserId: 'au_1' }), missed('b2', '2026-09-01T10:00')];
    const risky = planBooking(makeCore({ staff, bookings: history }), input, { now: NOW });
    assert.ok(risky.ok);
    if (!risky.ok) return;
    assert.equal(risky.plan.booking.status, 'awaiting_prepayment');
    assert.equal(risky.plan.booking.prepayment?.reason, 'no_shows');
    assert.equal(risky.plan.booking.prepayment?.noShows, 2);
    assert.equal(risky.plan.booking.prepayment?.amount, 1500);

    // Журнал: сотрудник записывает сам — предоплату не требуем
    const journal = planBooking(makeCore({ staff, bookings: history }), { ...input, source: 'journal', client: { clientId: 'cl_1' } }, { now: NOW });
    assert.ok(journal.ok && journal.plan.booking.status === 'scheduled' && !journal.plan.booking.prepayment);
  });
});
