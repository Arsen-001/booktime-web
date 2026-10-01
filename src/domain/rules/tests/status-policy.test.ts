import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_META,
  CANCELLED_STATUSES,
  DEFAULT_BOOKING_RULES,
  bookingStatusTone,
  canBookOnline,
  canCancelFree,
  canReschedule,
  canTransition,
  clientCancelOutcome,
  effectiveBookingRules,
  isActiveBooking,
  isCancelled,
  isPrepaymentExpired,
  isUpcoming,
  masterCancelRefund,
  minutesUntilStart,
  newBookingStatus,
  noShowDelta,
  occupiesTime,
  rescheduledStatus,
  splitClientBookings,
} from '@/domain/rules';
import { DAY, makeBooking, makeStaff } from '@/domain/rules/tests/fixture';

describe('статусы (F-00-068)', () => {
  test('у каждого статуса есть тон, значок и ключ подписи', () => {
    for (const s of BOOKING_STATUSES) {
      assert.ok(BOOKING_STATUS_META[s].tone);
      assert.equal(BOOKING_STATUS_META[s].labelKey, `bookingStatus.${s}`);
    }
  });
  test('отменённые не держат время, «не пришёл» держит', () => {
    assert.deepEqual([...CANCELLED_STATUSES], ['cancelled_by_client', 'cancelled_by_master']);
    assert.equal(occupiesTime({ status: 'cancelled_by_master' }), false);
    assert.equal(occupiesTime({ status: 'no_show' }), true);
    assert.equal(occupiesTime({ status: 'scheduled', deletedAt: '2026-09-01T10:00' }), false);
    assert.equal(isCancelled('cancelled_by_client'), true);
    assert.equal(isActiveBooking({ status: 'arrived' }), false);
  });
  test('клиенту отмена мастером — danger, в кабинете — neutral', () => {
    assert.equal(bookingStatusTone('cancelled_by_master', 'client'), 'danger');
    assert.equal(bookingStatusTone('cancelled_by_master'), 'neutral');
  });
  test('переходы: клиент только подтверждает и отменяет; сотрудник — любой, кроме «ждёт предоплату»', () => {
    assert.equal(canTransition('scheduled', 'client_confirmed', 'client'), true);
    assert.equal(canTransition('scheduled', 'arrived', 'client'), false);
    assert.equal(canTransition('arrived', 'cancelled_by_client', 'client'), false);
    assert.equal(canTransition('arrived', 'scheduled', 'business'), true);
    assert.equal(canTransition('scheduled', 'awaiting_prepayment', 'business'), false);
    assert.equal(canTransition('awaiting_prepayment', 'cancelled_by_client', 'system'), true);
    assert.equal(canTransition('scheduled', 'cancelled_by_client', 'system'), false);
  });
  test('счётчик неявок: вошли в «не пришёл» +1, вышли −1', () => {
    assert.equal(noShowDelta('scheduled', 'no_show'), 1);
    assert.equal(noShowDelta('no_show', 'arrived'), -1);
    assert.equal(noShowDelta('scheduled', 'arrived'), 0);
  });
  test('«Мои записи»: предстоящие, прошедшие, отменённые', () => {
    const list = [
      makeBooking({ id: 'past', start: '2026-09-20T10:00', status: 'arrived' }),
      makeBooking({ id: 'soon', start: `${DAY}T11:00` }),
      makeBooking({ id: 'later', start: '2026-10-05T11:00', status: 'awaiting_confirmation' }),
      makeBooking({ id: 'cx', start: '2026-10-02T11:00', status: 'cancelled_by_master' }),
      makeBooking({ id: 'del', start: '2026-10-02T11:00', deletedAt: '2026-09-25T10:00' }),
    ];
    const r = splitClientBookings(list, '2026-09-30T12:00');
    assert.deepEqual(r.upcoming.map((b) => b.id), ['soon', 'later']);
    assert.deepEqual(r.past.map((b) => b.id), ['past']);
    assert.deepEqual(r.cancelled.map((b) => b.id), ['cx']);
    assert.equal(isUpcoming(list[1], `${DAY}T11:30`), true);
    assert.equal(isUpcoming(list[1], `${DAY}T12:00`), false);
  });
});

describe('правила отмены и переноса (F-00-098/099, F-03-066/067)', () => {
  const booking = makeBooking({ start: `${DAY}T15:00` });

  test('правило мастера важнее бизнеса, пустые поля не перетирают', () => {
    const r = effectiveBookingRules({ bookingRules: { cancelWindowMin: 1440, allowCancelPrepaid: true } }, { bookingRules: { cancelWindowMin: 120 } });
    assert.equal(r.cancelWindowMin, 120);
    assert.equal(r.allowCancelPrepaid, true);
    assert.equal(r.rescheduleWindowMin, DEFAULT_BOOKING_RULES.rescheduleWindowMin);
    assert.deepEqual(effectiveBookingRules(undefined), DEFAULT_BOOKING_RULES);
  });
  test('раньше срока — бесплатно', () => {
    const rules = effectiveBookingRules({ bookingRules: { cancelWindowMin: 180 } });
    assert.equal(canCancelFree(booking, rules, `${DAY}T11:59`), true);
    const r = clientCancelOutcome(booking, rules, `${DAY}T11:59`);
    assert.deepEqual(r, { allowed: true, status: 'cancelled_by_client', late: false, noShowIncrement: 0, freeUntil: `${DAY}T12:00`, refund: 0, prepaymentKept: 0 });
  });
  test('предоплата: раньше срока — вернуть; позже — остаётся мастеру, если он так решил (В-04)', () => {
    const rules = effectiveBookingRules({ bookingRules: { cancelWindowMin: 180, allowCancelPrepaid: true } });
    const paid = { ...booking, prepayment: { amount: 3000, paid: true } };
    const early = clientCancelOutcome(paid, rules, `${DAY}T11:59`);
    assert.ok(early.allowed && early.refund === 3000 && early.prepaymentKept === 0);
    const late = clientCancelOutcome(paid, rules, `${DAY}T12:30`);
    assert.ok(late.allowed && late.refund === 0 && late.prepaymentKept === 3000);
    const lateGive = clientCancelOutcome(paid, { ...rules, keepPrepaymentOnLateCancel: false }, `${DAY}T12:30`);
    assert.ok(lateGive.allowed && lateGive.refund === 3000 && lateGive.prepaymentKept === 0);
  });
  test('позже срока — можно, но это неявка; статус «Отменил клиент», окно свободно', () => {
    const rules = effectiveBookingRules({ bookingRules: { cancelWindowMin: 180 } });
    const r = clientCancelOutcome(booking, rules, `${DAY}T12:00`);
    assert.equal(r.allowed, true);
    if (r.allowed) {
      assert.equal(r.status, 'cancelled_by_client');
      assert.equal(r.late, true);
      assert.equal(r.noShowIncrement, 1);
    }
  });
  test('начавшуюся, итоговую и оплаченную (без разрешения) — нельзя', () => {
    const rules = effectiveBookingRules(undefined);
    assert.deepEqual(clientCancelOutcome(booking, rules, `${DAY}T15:00`), { allowed: false, reason: 'started' });
    assert.deepEqual(clientCancelOutcome({ ...booking, status: 'arrived' }, rules, `${DAY}T10:00`), { allowed: false, reason: 'not_active' });
    const paid = { ...booking, prepayment: { amount: 3000, paid: true } };
    // ⭐ по умолчанию оплаченную запись отменить можно (владелец 29.09.2026); мастер может запретить
    assert.equal(clientCancelOutcome(paid, rules, `${DAY}T08:00`).allowed, true);
    assert.deepEqual(clientCancelOutcome(paid, { ...rules, allowCancelPrepaid: false }, `${DAY}T08:00`), { allowed: false, reason: 'prepaid_locked' });
    const unpaid = { ...booking, status: 'awaiting_prepayment' as const, prepayment: { amount: 3000, paid: false } };
    assert.equal(clientCancelOutcome(unpaid, rules, `${DAY}T08:00`).allowed, true);
  });
  test('перенос — только до срока', () => {
    const rules = effectiveBookingRules({ bookingRules: { rescheduleWindowMin: 60 } });
    assert.equal(canReschedule(booking, rules, `${DAY}T13:59`).allowed, true);
    assert.deepEqual(canReschedule(booking, rules, `${DAY}T14:00`), { allowed: false, reason: 'too_late', until: `${DAY}T14:00` });
    assert.equal(canReschedule(booking, { ...rules, allowReschedule: false }, `${DAY}T08:00`).allowed, false);
  });
  test('минуты до начала через полночь', () => {
    assert.equal(minutesUntilStart({ start: '2026-10-01T01:00' }, '2026-09-30T23:30'), 90);
    assert.equal(minutesUntilStart({ start: '2026-10-01T01:00' }, '2026-10-01T02:00'), -60);
  });
});

describe('статус новой записи (F-00-067/079/097, F-00-065)', () => {
  const instant = makeStaff();
  const manual = makeStaff({ confirmMode: 'manual' });
  const prepay = makeStaff({ prepayment: { amount: 3000, timeoutMin: 15, requisites: 'Idram' } });

  test('сотрудник записывает — «Записан» при любых правилах', () => {
    assert.equal(newBookingStatus({ source: 'journal', staff: manual, workplace: 'visit' }), 'scheduled');
  });
  test('выезд всегда ждёт подтверждения, даже при «записи сразу»', () => {
    assert.equal(newBookingStatus({ source: 'app', staff: instant, workplace: 'visit' }), 'awaiting_confirmation');
    assert.equal(newBookingStatus({ source: 'widget', staff: prepay, workplace: 'visit' }), 'awaiting_confirmation');
  });
  test('предоплата, ручное подтверждение, «сразу»', () => {
    assert.equal(newBookingStatus({ source: 'app', staff: prepay, workplace: 'salon' }), 'awaiting_prepayment');
    assert.equal(newBookingStatus({ source: 'link', staff: manual, workplace: 'salon' }), 'awaiting_confirmation');
    assert.equal(newBookingStatus({ source: 'widget', staff: instant, workplace: 'salon' }), 'scheduled');
  });
  test('«Только мои клиенты»: чужой — заявкой, свой — как обычно', () => {
    const mine = makeStaff({ calendarVisibility: 'mine' });
    assert.equal(newBookingStatus({ source: 'app', staff: mine, workplace: 'salon', isOwnClient: false }), 'awaiting_confirmation');
    assert.equal(newBookingStatus({ source: 'app', staff: mine, workplace: 'salon', isOwnClient: true }), 'scheduled');
  });
  test('перенос оплаченной записи не требует предоплаты снова', () => {
    const b = makeBooking({ source: 'app', prepayment: { amount: 3000, paid: true } });
    assert.equal(rescheduledStatus(b, prepay), 'scheduled');
  });
  test('можно ли записаться онлайн', () => {
    const base = { business: { status: 'active' as const }, staff: instant, date: DAY };
    assert.equal(canBookOnline(base), undefined);
    assert.equal(canBookOnline({ ...base, business: { status: 'frozen' } }), 'business_inactive');
    assert.equal(canBookOnline({ ...base, staff: makeStaff({ onlineBookingEnabled: false }) }), 'online_disabled');
    assert.equal(canBookOnline({ ...base, pauseUntil: DAY }), 'online_paused');
    assert.equal(canBookOnline({ ...base, vacationUntil: '2026-09-30' }), undefined);
    assert.equal(canBookOnline({ ...base, client: { blocked: true, gender: 'unknown' } }), 'client_blocked');
    assert.equal(canBookOnline({ ...base, staff: makeStaff({ accepts: 'women' }), appUser: { gender: 'male' } }), 'accepts_mismatch');
    assert.equal(canBookOnline({ ...base, staff: makeStaff({ accepts: 'women' }), client: { gender: 'unknown' } }), undefined);
  });
  test('просроченная предоплата и возврат при отмене мастером', () => {
    const b = makeBooking({ status: 'awaiting_prepayment', prepayment: { amount: 3000, paid: false, holdUntil: '2026-09-30T12:15' } });
    assert.equal(isPrepaymentExpired(b, '2026-09-30T12:14'), false);
    assert.equal(isPrepaymentExpired(b, '2026-09-30T12:15'), true);
    assert.equal(isPrepaymentExpired({ ...b, prepayment: { amount: 3000, paid: true, holdUntil: '2026-09-30T12:15' } }, '2026-09-30T13:00'), false);
    assert.equal(masterCancelRefund({ prepayment: { amount: 3000, paid: true } }), 3000);
    assert.equal(masterCancelRefund({ prepayment: { amount: 3000, paid: false } }), 0);
  });
});
