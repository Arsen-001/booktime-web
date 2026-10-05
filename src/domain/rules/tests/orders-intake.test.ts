import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DEFAULT_INTAKE_SLOT_MIN,
  intakeBookHref,
  intakeSettingsOf,
  intakeSlotOf,
  isIntakeBooking,
  isIntakeService,
} from '@/domain/ordersIntake';
import { staffClientVisibility, visibleBusinessServices, visibleServices } from '@/domain/rules';
import { makeBooking, makeCore, makeService, makeStaff } from '@/domain/rules/tests/fixture';

// ⭐ Запись на сдачу по времени (05.10.2026): скрытая услуга «Приём заказа» (kind 'intake') — те же правила, что у сервера
const intake = makeService({ id: 'sv_intake', name: { ru: 'Приём заказа' }, kind: 'intake', durationMin: 15, priceMin: 0, staffIds: ['st_anna'] });

describe('запись на сдачу — правила', () => {
  test('длина окна: из списка, иначе ближайшая; нет услуги — выключено, 15 мин', () => {
    assert.equal(intakeSlotOf(15), 15);
    assert.equal(intakeSlotOf(25), 20);
    assert.equal(intakeSlotOf(90), 60);
    assert.equal(intakeSlotOf(undefined), DEFAULT_INTAKE_SLOT_MIN);
    assert.deepEqual(intakeSettingsOf(undefined), { enabled: false, slotMin: 15, staffIds: [], serviceId: null });
    assert.deepEqual(intakeSettingsOf(intake), { enabled: true, slotMin: 15, staffIds: ['st_anna'], serviceId: 'sv_intake' });
    assert.equal(intakeSettingsOf({ ...intake, onlineBookable: false }).enabled, false);
  });

  test('запись на сдачу — по строке с услугой приёма; обычная услуга — нет', () => {
    assert.equal(isIntakeService(intake), true);
    assert.equal(isIntakeService(makeService()), false);
    assert.equal(isIntakeBooking(makeBooking({ services: [{ serviceId: 'sv_intake', staffId: 'st_anna', price: 0, durationMin: 15, qty: 1 }] }), 'sv_intake'), true);
    assert.equal(isIntakeBooking(makeBooking(), 'sv_intake'), false);
    assert.equal(isIntakeBooking(makeBooking(), null), false);
  });

  test('ссылка «Записаться на сдачу» — сразу шаг «Время», любой из принимающих', () => {
    assert.equal(intakeBookHref('fixpoint', 'sv_fix_intake'), '/b/fixpoint/book?s=sv_fix_intake&m=any&step=time');
  });

  test('«Приём заказа» — не услуга каталога: мастер только с приёмом в каталоге не записывается', () => {
    const core = makeCore({ services: [intake], staff: [makeStaff({ serviceIds: ['sv_intake'] })] });
    assert.deepEqual(visibleServices(core, core.staff[0]), []);
    assert.deepEqual(visibleBusinessServices(core, 'biz_1'), []);
    const v = staffClientVisibility(core, core.staff[0]);
    assert.equal(v.catalog, false);
    assert.equal(v.bookable, false);
    assert.ok(v.reasons.includes('no_services'));
    const mixed = makeCore({ services: [makeService(), intake], staff: [makeStaff({ serviceIds: ['sv_mani', 'sv_intake'] })] });
    assert.deepEqual(visibleServices(mixed, mixed.staff[0]).map((s) => s.id), ['sv_mani']);
  });
});
