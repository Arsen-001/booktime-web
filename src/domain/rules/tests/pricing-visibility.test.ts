import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  applyDiscount,
  bookedDuration,
  bookedPrice,
  can,
  canCallNow,
  canSeeHomeAddress,
  canWith,
  clientForStaff,
  hiddenByModeration,
  isOwnClient,
  isStaffBookableOnline,
  isStaffInCatalog,
  lineDiscount,
  lineTotal,
  makeServiceLine,
  permissionsOf,
  prepaymentAmount,
  canPayInFull,
  hasPrepayment,
  priceRange,
  staffClientVisibility,
  toPublicBusiness,
  toPublicStaff,
  visibleServices,
  visitTotal,
} from '@/domain/rules';
import { DAY, makeBooking, makeCore, makeService, makeStaff } from '@/domain/rules/tests/fixture';

describe('цена и скидка (F-00-057, F-06-184)', () => {
  const svc = makeService({ durationMin: 60, durationMax: 90, priceMin: 8000, priceMax: 12000 });
  test('«от–до»: длительность — верх, цена — низ', () => {
    assert.equal(bookedDuration(svc), 90);
    assert.equal(bookedPrice(svc), 8000);
    assert.deepEqual(priceRange(svc), { min: 8000, max: 12000 });
    assert.deepEqual(priceRange(makeService({ priceMin: 5000, priceMax: 5000 })), { min: 5000 });
  });
  test('строка со скидкой: итог без деления и потери драмов', () => {
    const line = makeServiceLine(svc, 'st_anna', { qty: 2, discountPct: 15 });
    assert.deepEqual(line, { serviceId: 'sv_mani', staffId: 'st_anna', durationMin: 90, qty: 2, price: 6800, unitPrice: 8000, discountPct: 15 });
    assert.equal(lineTotal(line), 13600);
    assert.equal(lineDiscount(line), 2400);
    // старая строка без полей скидки — price и есть цена
    assert.equal(lineTotal({ price: 5000, qty: 1 }), 5000);
  });
  test('округление до драма, процент в пределах 0–100', () => {
    assert.equal(applyDiscount(3333, 10), 3000);
    assert.equal(applyDiscount(1000, 150), 0);
    assert.equal(applyDiscount(1000, -5), 1000);
  });
  test('итог визита: услуги + товары', () => {
    assert.equal(visitTotal([{ price: 5000, qty: 1 }], [{ price: 2000, qty: 2, discountPct: 50 }]), 7000);
  });
  test('предоплата не больше суммы записи', () => {
    assert.equal(prepaymentAmount({ amount: 5000, timeoutMin: 15, requisites: '' }, 3000), 3000);
    assert.equal(prepaymentAmount(undefined, 3000), 0);
  });
  test('предоплата процентом: вверх до 100 ֏; «всё сразу» — вся сумма', () => {
    const rule = { amount: 0, percent: 30, timeoutMin: 15, requisites: '' };
    assert.equal(prepaymentAmount(rule, 7500), 2300);
    assert.equal(prepaymentAmount(rule, 7500, true), 7500);
    assert.equal(canPayInFull(rule, 7500), true);
    assert.equal(canPayInFull({ ...rule, percent: 100 }, 7500), false);
    assert.equal(hasPrepayment({ amount: 0, percent: 0 }), false);
  });
});

describe('кого видно клиенту (F-00-065/072, F-03-134)', () => {
  test('обычный мастер — в каталоге, по ссылке, записывается', () => {
    const core = makeCore();
    const v = staffClientVisibility(core, core.staff[0]);
    assert.deepEqual(v, { catalog: true, link: true, bookable: true, requestOnly: false, reasons: [] });
  });
  test('«по ссылке» — не в каталоге; «только мои» — заявкой', () => {
    const link = makeCore({ staff: [makeStaff({ calendarVisibility: 'link' })] });
    assert.equal(isStaffInCatalog(link, link.staff[0]), false);
    assert.equal(isStaffBookableOnline(link, link.staff[0]), true);
    const mine = makeCore({ staff: [makeStaff({ calendarVisibility: 'mine' })] });
    const v = staffClientVisibility(mine, mine.staff[0]);
    assert.equal(v.catalog, false);
    assert.equal(v.requestOnly, true);
  });
  test('пустой профиль (без фото / услуг / графика) не в каталоге', () => {
    const noPhoto = makeCore({ staff: [makeStaff({ photos: [] })] });
    assert.deepEqual(staffClientVisibility(noPhoto, noPhoto.staff[0]).reasons, ['no_photo']);
    assert.equal(isStaffInCatalog(noPhoto, noPhoto.staff[0]), false);
    const noSchedule = makeCore({ schedules: [] });
    assert.equal(isStaffBookableOnline(noSchedule, noSchedule.staff[0]), false);
  });
  test('заморожен бизнес, выключена онлайн-запись, скрыт модерацией — не виден нигде', () => {
    const frozen = makeCore();
    frozen.businesses[0].status = 'frozen';
    assert.deepEqual(staffClientVisibility(frozen, frozen.staff[0]).reasons, ['business_inactive']);
    const off = makeCore({ staff: [makeStaff({ onlineBookingEnabled: false })] });
    assert.equal(staffClientVisibility(off, off.staff[0]).link, false);
    const core = makeCore();
    const hidden = hiddenByModeration([
      { refId: 'st_anna', status: 'pending' },
      { refId: 'sv_long', status: 'rejected' },
      { refId: 'sv_mani', status: 'approved' },
    ]);
    assert.equal(staffClientVisibility(core, core.staff[0], { hiddenIds: hidden }).link, false);
    assert.deepEqual(
      visibleServices(core, core.staff[0], { hiddenIds: hidden }).map((s) => s.id),
      ['sv_mani', 'sv_group'],
    );
  });
  test('«свой» клиент — был визит к мастеру', () => {
    const core = makeCore({ bookings: [makeBooking({ clientId: 'cl_1', appUserId: 'au_1' })] });
    assert.equal(isOwnClient(core, 'st_anna', { appUserId: 'au_1' }), true);
    assert.equal(isOwnClient(core, 'st_anna', { appUserId: 'au_new' }), false);
  });
});

describe('публичные DTO (F-00-077/104/130)', () => {
  test('без телефона, логина и домашнего адреса по умолчанию', () => {
    const dto = toPublicStaff(makeStaff());
    const keys = Object.keys(dto);
    assert.ok(!keys.includes('login'));
    assert.equal(dto.homeAddress, undefined);
    assert.equal(dto.contacts, undefined);
    assert.ok(!JSON.stringify(dto).includes('+37400111111'));
    assert.ok(!JSON.stringify(dto).includes('anna.admin'));
  });
  test('телефон — только если мастер открыл звонок или WhatsApp', () => {
    assert.equal(toPublicStaff(makeStaff({ contacts: { callMode: 'messages', telegram: 'anna' } })).contacts?.phone, undefined);
    assert.equal(toPublicStaff(makeStaff({ contacts: { callMode: 'always' } })).contacts?.phone, '+37400111111');
  });
  test('домашний адрес — после подтверждённой записи на дому этого клиента', () => {
    const pending = makeCore({ bookings: [makeBooking({ appUserId: 'au_1', workplace: 'home', status: 'awaiting_confirmation' })] });
    assert.equal(canSeeHomeAddress(pending, 'st_anna', { appUserId: 'au_1' }), false);
    const confirmed = makeCore({ bookings: [makeBooking({ appUserId: 'au_1', workplace: 'home', status: 'scheduled' })] });
    assert.equal(canSeeHomeAddress(confirmed, 'st_anna', { appUserId: 'au_1' }), true);
    assert.equal(canSeeHomeAddress(confirmed, 'st_anna', { appUserId: 'au_new' }), false);
    assert.equal(toPublicStaff(makeStaff(), { revealHomeAddress: true }).homeAddress, 'ул. Абовяна 1, кв. 5');
  });
  test('фото на проверке не уходят; телефон индивидуала не уходит через бизнес', () => {
    assert.deepEqual(toPublicStaff(makeStaff({ photos: ['p1', 'p2'] }), { hiddenIds: new Set(['p2']) }).photos, ['p1']);
    const core = makeCore();
    assert.equal(toPublicBusiness(core.businesses[0]).phone, '+37400100000');
    assert.equal(toPublicBusiness({ ...core.businesses[0], kind: 'individual' }).phone, undefined);
  });
  test('кнопка «Позвонить» по режиму (F-00-105)', () => {
    const hours = makeStaff({ contacts: { callMode: 'hours' }, callHours: { from: '10:00', to: '18:00' } });
    assert.equal(canCallNow(hours, `${DAY}T09:59`), false);
    assert.equal(canCallNow(hours, `${DAY}T10:00`), true);
    const busy = makeStaff({ contacts: { callMode: 'busy' } });
    assert.equal(canCallNow(busy, `${DAY}T11:30`, [{ from: 660, to: 720 }]), false);
    assert.equal(canCallNow(busy, `${DAY}T12:00`, [{ from: 660, to: 720 }]), true);
    assert.equal(canCallNow(makeStaff(), `${DAY}T12:00`), false);
  });
  test('номер клиента маскируется без права clients.phones', () => {
    assert.notEqual(clientForStaff({ phone: '+37400133333' }, false).phone, '+37400133333');
    assert.equal(clientForStaff({ phone: '+37400133333' }, true).phone, '+37400133333');
  });
});

describe('права — can() (F-00-039)', () => {
  test('по персоне и галочкам владельца', () => {
    assert.equal(can('owner', 'clients.export'), true);
    assert.equal(can('admin', 'clients.export'), false);
    assert.equal(can('admin', 'clients.export', { overrides: ['clients.view', 'clients.export'] }), true);
    // галочки действуют только для администратора
    assert.equal(can('master', 'clients.export', { overrides: ['clients.view', 'clients.export'] }), false);
    assert.equal(can('client', 'journal.view'), false);
    assert.equal(permissionsOf('platform').has('platform.access'), true);
  });
  test('зависимые права: без базового не работают', () => {
    assert.equal(canWith(new Set(['journal.create'] as const), 'journal.create'), false);
    assert.equal(canWith(new Set(['journal.view', 'journal.edit', 'journal.create'] as const), 'journal.create'), true);
    assert.equal(canWith(new Set(['clients.phones'] as const), 'clients.phones'), false);
  });
  test('чужие записи — только с journal.others', () => {
    assert.equal(can('master', 'journal.edit', { actorStaffId: 'st_a', targetStaffId: 'st_a' }), true);
    assert.equal(can('master', 'journal.edit', { actorStaffId: 'st_a', targetStaffId: 'st_b' }), false);
    assert.equal(can('admin', 'journal.reschedule', { actorStaffId: 'st_a', targetStaffId: 'st_b' }), true);
  });
});
