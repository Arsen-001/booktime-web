import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  busyForViewer,
  busyIntervals,
  checkSlot,
  dayBreaks,
  freeSlots,
  hasBookingOverlap,
  mergeIntervals,
  nearestAvailableDate,
  overlaps,
  slotNeedsForService,
  staffDayHours,
  staffWorkIntervals,
  subtractInterval,
} from '@/domain/rules';
import { DAY, NOW, makeBooking, makeCore, makeSchedule, makeService, makeStaff } from '@/domain/rules/tests/fixture';

const starts = (slots: { start: string }[]) => slots.map((s) => s.start.slice(11));

describe('интервалы', () => {
  test('касание концами — не пересечение', () => {
    assert.equal(overlaps([600, 660], [660, 720]), false);
    assert.equal(overlaps([600, 661], [660, 720]), true);
  });
  test('вычитание и объединение', () => {
    assert.deepEqual(subtractInterval([[600, 900]], [660, 720]), [
      [600, 660],
      [720, 900],
    ]);
    assert.deepEqual(mergeIntervals([[700, 800], [600, 700], [900, 950]]), [
      [600, 800],
      [900, 950],
    ]);
  });
});

describe('часы мастера', () => {
  test('объединение графиков и перерывы', () => {
    const core = makeCore();
    assert.deepEqual(staffDayHours(core, 'st_anna', DAY), [
      { from: '10:00', to: '14:00' },
      { from: '15:00', to: '19:00' },
    ]);
    assert.deepEqual(dayBreaks(staffDayHours(core, 'st_anna', DAY)), [{ from: '14:00', to: '15:00' }]);
  });
  test('исключение на дату важнее шаблона; пустое — выходной', () => {
    const core = makeCore({ schedules: [makeSchedule({ overrides: { [DAY]: [] } })] });
    assert.deepEqual(staffDayHours(core, 'st_anna', DAY), []);
    assert.deepEqual(freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 60 }, NOW), []);
  });
  test('режим «всё занято» — только открытые отметки', () => {
    const core = makeCore({
      staff: [makeStaff({ calendarMode: 'busy' })],
      calendarMarks: [{ id: 'mk1', staffId: 'st_anna', date: DAY, from: '12:00', to: '13:30', kind: 'free' }],
    });
    const work = staffWorkIntervals(core, 'st_anna', DAY);
    assert.deepEqual(work.map((w) => [w.from, w.to]), [[720, 810]]);
    assert.deepEqual(starts(freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 60 }, NOW)), ['12:00', '12:30']);
  });
  test('отметка «занято» вычитается в режиме «всё свободно»', () => {
    const core = makeCore({ calendarMarks: [{ id: 'mk1', staffId: 'st_anna', date: DAY, from: '10:00', to: '13:00', kind: 'busy' }] });
    assert.deepEqual(starts(freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 60 }, NOW)).slice(0, 2), ['13:00', '15:00']);
  });
});

describe('окна (F-00-056/057)', () => {
  test('окна только там, где услуга помещается целиком', () => {
    const core = makeCore({ bookings: [makeBooking({ start: `${DAY}T11:00`, durationMin: 60 })] });
    const hour = starts(freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 60 }, NOW));
    assert.deepEqual(hour, ['10:00', '12:00', '12:30', '13:00', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00']);
    // 30 свободных минут 10:30–11:00 годятся получасовой услуге, но не часовой
    const half = starts(freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 30 }, NOW));
    assert.ok(half.includes('10:30'));
    assert.ok(!hour.includes('10:30'));
  });
  test('«от–до» бронирует верхнюю границу + запас услуги', () => {
    const svc = makeService({ id: 'x', durationMin: 60, durationMax: 90, bufferAfterMin: 15 });
    assert.deepEqual(slotNeedsForService(svc), { durationMin: 90, bufferAfterMin: 15 });
    const core = makeCore();
    const s = starts(freeSlots(core, { staffId: 'st_anna', date: DAY, ...slotNeedsForService(svc) }, NOW));
    // до перерыва в 14:00: 90 + 15 = 105 мин → последнее начало 12:00 (12:00–13:45)
    assert.ok(s.includes('12:00'));
    assert.ok(!s.includes('12:30'));
  });
  test('запас после чужой записи держит время', () => {
    const core = makeCore({
      bookings: [makeBooking({ start: `${DAY}T10:00`, durationMin: 60, services: [{ serviceId: 'sv_long', staffId: 'st_anna', price: 8000, durationMin: 60, qty: 1 }] })],
    });
    const s = starts(freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 30, stepMin: 15 }, NOW));
    assert.equal(s[0], '11:15');
  });
  test('отменённые и удалённые записи время не держат', () => {
    const core = makeCore({
      bookings: [
        makeBooking({ id: 'a', start: `${DAY}T10:00`, status: 'cancelled_by_client' }),
        makeBooking({ id: 'b', start: `${DAY}T10:00`, deletedAt: '2026-09-29T10:00' }),
      ],
    });
    assert.equal(starts(freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 60 }, NOW))[0], '10:00');
  });
  test('сегодня — не раньше «сейчас»; прошлые даты — пусто', () => {
    const core = makeCore();
    assert.equal(starts(freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 60 }, `${DAY}T15:10`))[0], '15:30');
    assert.deepEqual(freeSlots(core, { staffId: 'st_anna', date: '2026-09-29', durationMin: 60 }, NOW), []);
  });
  test('неактивный мастер — окон нет', () => {
    const core = makeCore({ staff: [makeStaff({ status: 'fired' })] });
    assert.deepEqual(freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 60 }, NOW), []);
  });
  test('ближайшая доступная дата пропускает выходные', () => {
    const core = makeCore({ schedules: [makeSchedule({ overrides: { [DAY]: [], '2026-10-02': [] } })] });
    assert.equal(nearestAvailableDate(core, { staffId: 'st_anna', durationMin: 60 }, DAY, NOW), '2026-10-03');
  });
});

describe('«свободно ли в 15:00» — одно правило (F-00-045)', () => {
  const core = makeCore({ bookings: [makeBooking({ start: `${DAY}T15:00`, durationMin: 60 })] });
  test('каждое показанное окно проходит проверку', () => {
    for (const slot of freeSlots(core, { staffId: 'st_anna', date: DAY, durationMin: 60 }, NOW)) {
      assert.equal(checkSlot(core, { staffId: 'st_anna', start: slot.start, durationMin: 60 }, NOW).ok, true, slot.start);
    }
  });
  test('занято / вне часов / прошлое', () => {
    assert.deepEqual(checkSlot(core, { staffId: 'st_anna', start: `${DAY}T15:30`, durationMin: 60 }, NOW), {
      ok: false,
      reason: 'busy',
      conflictBookingId: 'bk_1',
    });
    assert.equal((checkSlot(core, { staffId: 'st_anna', start: `${DAY}T13:30`, durationMin: 60 }, NOW) as { reason: string }).reason, 'outside_hours');
    assert.equal((checkSlot(core, { staffId: 'st_anna', start: '2026-09-30T10:00', durationMin: 60 }, NOW) as { reason: string }).reason, 'past');
  });
  test('журнал: вне часов можно, двойная запись — нет', () => {
    assert.equal(checkSlot(core, { staffId: 'st_anna', start: `${DAY}T20:00`, durationMin: 60, checkHours: false }, NOW).ok, true);
    assert.equal(hasBookingOverlap(core, 'st_anna', `${DAY}T15:30`, 30), true);
    assert.equal(hasBookingOverlap(core, 'st_anna', `${DAY}T15:30`, 30, 'bk_1'), false);
  });
  test('запись той же персоны в другом бизнесе закрывает время (по телефону)', () => {
    const twin = makeStaff({ id: 'st_anna_home', businessId: 'biz_home', locationIds: ['loc_home'] });
    const c = makeCore({
      staff: [makeStaff(), twin],
      bookings: [makeBooking({ id: 'home1', businessId: 'biz_home', locationId: 'loc_home', staffId: 'st_anna_home', start: `${DAY}T12:00`, workplace: 'home' })],
    });
    assert.equal(checkSlot(c, { staffId: 'st_anna', start: `${DAY}T12:00`, durationMin: 60 }, NOW).ok, false);
    // салон видит «занято · дома» без id записи (F-00-046)
    const seen = busyForViewer(busyIntervals(c, 'st_anna', DAY), { businessId: 'biz_1', staffIds: ['st_owner'] });
    assert.deepEqual(seen, [{ from: 720, to: 780, kind: 'foreign', workplace: 'home' }]);
    // сам мастер свою домашнюю запись видит целиком
    const self = busyForViewer(busyIntervals(c, 'st_anna', DAY), { businessId: 'biz_home', staffIds: ['st_anna_home'] });
    assert.equal(self[0].bookingId, 'home1');
  });
});
