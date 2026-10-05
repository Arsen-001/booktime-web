import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { canBookPickup, isOrderService, isPickupBooking, isPickupService, PICKUP_COMMENT_MAX, pickupBookingComment, pickupDates } from '@/domain/ordersPickup';
import { planBooking, staffClientVisibility, visibleBusinessServices, type PlaceBookingInput } from '@/domain/rules';
import { DAY, NOW, makeBooking, makeCore, makeService, makeStaff } from '@/domain/rules/tests/fixture';

// ⭐ Выдача по времени (06.10.2026): вторая скрытая услуга «Выдача заказа» (kind 'pickup') — те же правила, что у сервера
const pickup = makeService({ id: 'sv_pickup', name: { ru: 'Выдача заказа' }, kind: 'pickup', durationMin: 15, priceMin: 0, staffIds: ['st_anna'], onlineBookable: false });

const base: PlaceBookingInput = {
  source: 'link',
  businessId: 'biz_1',
  staffId: 'st_anna',
  start: `${DAY}T10:00`,
  services: [{ serviceId: 'sv_pickup' }],
  client: { phone: '+37400133333', name: 'Кара' },
};

describe('выдача по времени — правила', () => {
  test('«Выдача заказа» — скрытая услуга заказов; запись на неё узнаётся по услуге', () => {
    assert.equal(isPickupService(pickup), true);
    assert.equal(isOrderService(pickup), true);
    assert.equal(isOrderService(makeService({ kind: 'intake' })), true);
    assert.equal(isOrderService(makeService()), false);
    assert.equal(isPickupBooking(makeBooking({ services: [{ serviceId: 'sv_pickup', staffId: 'st_anna', price: 0, durationMin: 15, qty: 1 }] }), 'sv_pickup'), true);
    assert.equal(isPickupBooking(makeBooking(), 'sv_pickup'), false);
    assert.equal(isPickupBooking(makeBooking(), null), false);
  });

  test('время выдачи — только у готового заказа, на неделю вперёд с сегодня', () => {
    assert.equal(canBookPickup('ready'), true);
    assert.equal(canBookPickup('in_progress'), false);
    assert.equal(canBookPickup('issued'), false);
    const days = pickupDates('2026-10-06');
    assert.equal(days.length, 7);
    assert.equal(days[0], '2026-10-06');
    assert.equal(days[6], '2026-10-12');
  });

  test('комментарий записи — номер и что забирают, не длиннее 150 знаков', () => {
    assert.equal(pickupBookingComment(1024, [{ title: 'iPhone 14', qty: 1 }, { title: 'Стекло', qty: 2 }]), '№1024 · iPhone 14 · Стекло ×2');
    assert.equal(pickupBookingComment(7, []), '№7');
    assert.ok(pickupBookingComment(1, [{ title: 'x'.repeat(400), qty: 1 }]).length <= PICKUP_COMMENT_MAX);
  });

  test('не онлайн-услуга: в каталоге её нет, мастер только с ней не записывается', () => {
    const core = makeCore({ services: [pickup], staff: [makeStaff({ serviceIds: [] })] });
    assert.deepEqual(visibleBusinessServices(core, 'biz_1'), []);
    assert.equal(staffClientVisibility(core, core.staff[0]).catalog, false);
  });

  test('запись: в общем онлайн-потоке — отказ; по ссылке заказа (orderPickup) — «Записан» без подтверждения и предоплаты', () => {
    const core = makeCore({
      services: [makeService(), pickup],
      staff: [makeStaff({ serviceIds: ['sv_mani'], confirmMode: 'manual', prepayment: { mode: 'percent', value: 50, timeoutMin: 30 } as never })],
    });
    assert.deepEqual(planBooking(core, base, { now: NOW }), { ok: false, code: 'service_unavailable' });
    const r = planBooking(core, { ...base, orderPickup: true }, { now: NOW });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.plan.booking.status, 'scheduled');
    assert.equal(r.plan.booking.prepayment, undefined);
    // Флаг не открывает обычные услуги в обход онлайн-настроек
    assert.equal(planBooking(core, { ...base, services: [{ serviceId: 'sv_mani' }], orderPickup: true }, { now: NOW }).ok, false);
  });
});
