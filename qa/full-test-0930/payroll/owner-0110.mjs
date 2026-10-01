// Решения владельца 01.10 + F-09-005 + F-09-027 — проверка действием на сиде и синтетике.
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {}; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const api = await jiti.import(root + '/src/api/payroll.ts');
const D = await jiti.import(root + '/src/domain/payroll.ts');
const st = () => db.useDb.getState();
let pass = 0, fail = 0;
const chk = (name, ok, info = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} ${info}`); };
// (2) права администратора
const a1 = api.resolvePayrollAccess('admin', 'ADM', {}, false);
chk('админ по умолчанию: только своя', a1.ownOnlyStaffId === 'ADM' && a1.calcAccess === 'all' && a1.accrueAccess === 'none' && !a1.schemesAccess, JSON.stringify(a1));
const a2 = api.resolvePayrollAccess('admin', 'ADM', { ADM: { staffId: 'ADM', schemesAccess: false, calcAccess: 'all', accrueAccess: 'none' } }, false);
chk('админ с открытым расчётом, но без payroll.view: только своя', a2.ownOnlyStaffId === 'ADM', JSON.stringify(a2));
const a3 = api.resolvePayrollAccess('admin', 'ADM', { ADM: { staffId: 'ADM', schemesAccess: false, calcAccess: 'all', accrueAccess: 'none' } }, true);
chk('админ с payroll.view + открытым расчётом: все', a3.ownOnlyStaffId === undefined, JSON.stringify(a3));
const a4 = api.resolvePayrollAccess('owner', 'OWN', {}, false);
chk('владелец: все', a4.ownOnlyStaffId === undefined && a4.accrueAccess === 'all');
const perms = await jiti.import(root + '/src/config/permissions.ts');
const adminPerms = (perms.ROLE_PERMISSIONS ?? perms.PERSONA_PERMISSIONS ?? perms.DEFAULT_PERMISSIONS ?? {}).admin;
console.log('     права admin по умолчанию содержат payroll.view/manage:', adminPerms ? adminPerms.includes('payroll.view') || adminPerms.includes('payroll.manage') : 'не нашёл экспорт');
// (3) доп. от прибыли — месяц целиком, по дням пропорционально обороту (решение 01.10, уточнено)
{
  const LOC = 'loc_kaytsak', erik = 'st_kaytsak_erik', biz = 'biz_kaytsak';
  const arrived = st().core.bookings.filter(b => b.locationId === LOC && b.status === 'arrived' && !b.deletedAt);
  const T = (from, to) => arrived.filter(b => b.start.slice(0, 10) >= from && b.start.slice(0, 10) <= to).reduce((s, b) => s + b.total, 0);
  const expOps = () => st().areas.finance.operations.filter(o => o.locationId === LOC && o.kind === 'expense' && !o.cancelled);
  const E = (from, to) => expOps().filter(o => o.date.slice(0, 10) >= from && o.date.slice(0, 10) <= to).reduce((s, o) => s + o.amount, 0);
  const Tm = T('2026-09-01', '2026-09-30'), Em = E('2026-09-01', '2026-09-30');
  const p = (await api.computePeriod(LOC, '2026-09-01', '2026-09-30')).rows.find(r => r.staffId === erik).breakdown;
  const exp = Math.max(0, Tm - Em) * 0.05;
  chk('доп. от прибыли за сентябрь = 5 % × (оборот − расходы месяца)', Math.abs(p.extra - exp) < 1, `оборот ${Tm}, расходы ${Em} → ${p.extra} (ожидалось ${exp.toFixed(2)}), условно=${p.extraProfitAssumed}`);
  const day = '2026-09-24', Td = T(day, day);
  const d = (await api.computeDay(LOC, day)).staff.find(r => r.staffId === erik).extraAmount;
  const expD = Math.max(0, Tm - Em) * (Td / Tm) * 0.05;
  chk('день 24.09 = доля дня в обороте месяца (день без расходов ≠ весь оборот)', Math.abs(d - expD) < 0.02 && d < Td * 0.05, `день ${d}, ожидалось ${expD.toFixed(2)}, «прибыль = оборот» дала бы ${Td * 0.05}`);
  let sum = 0; for (let i = 1; i <= 30; i++) { const dt = `2026-09-${String(i).padStart(2, '0')}`; sum += (await api.computeDay(LOC, dt)).staff.find(r => r.staffId === erik)?.extraAmount ?? 0; }
  chk('сумма дней = период', Math.abs(sum - p.extra) < 1, `${sum.toFixed(2)} / ${p.extra}`);
  const saved = st().areas.finance.operations;
  st().setArea('finance', f => ({ ...f, operations: f.operations.filter(o => !(o.locationId === LOC && o.kind === 'expense')) }));
  const p2 = (await api.computePeriod(LOC, '2026-09-01', '2026-09-30')).rows.find(r => r.staffId === erik).breakdown;
  chk('без расходов вообще: 70 % условно + подпись', Math.abs(p2.extra - Tm * 0.3 * 0.05) < 1 && p2.extraProfitAssumed === true, `${p2.extra} флаг=${p2.extraProfitAssumed}`);
  st().setArea('finance', f => ({ ...f, operations: saved }));
}
// (4) API режет строки без payroll.view: подменяем cookie персоны на admin
{
  globalThis.document = { cookie: 'demo_persona=admin; demo_sphere=nails' };
  const core = await jiti.import(root + '/src/api/core.ts');
  const actor = core.currentActor();
  console.log('     актёр:', actor.persona, actor.staffId, 'payroll.view:', actor.permissions.has('payroll.view'));
  const rows = (await api.computePeriod('loc_nuri', '2026-09-01', '2026-09-30')).rows.map(r => r.staffId);
  chk('computePeriod для admin без payroll.view — только своя строка', rows.length === 1 && rows[0] === actor.staffId, JSON.stringify(rows));
  const drows = (await api.computeDay('loc_nuri', '2026-09-20')).staff.map(r => r.staffId);
  chk('computeDay для admin — не больше своей строки', drows.every(id => id === actor.staffId), JSON.stringify(drows));
  globalThis.document = { cookie: 'demo_persona=owner; demo_sphere=nails' };
  const rowsO = (await api.computePeriod('loc_nuri', '2026-09-01', '2026-09-30')).rows.length;
  chk('владелец — все строки', rowsO > 1, String(rowsO));
  delete globalThis.document;
}
// F-09-027 в движке
{
  const svc = [{ id: 's', name: { ru: 's' }, priceMin: 1000 }];
  const sc = D.emptyScheme('M', '2026-01-01T00:00');
  sc.personalServices = { ...sc.personalServices, enabled: true, defaultPayout: { unit: 'percent', value: 40 }, consumables: { mode: 'full', applyClientDiscount: false } };
  const run = (basis, disc = 0) => { const s2 = { ...sc, serviceCostBasis: basis }; const price = 1000 * (1 - disc / 100); const r = D.computeServicesForDay({ date: '2026-09-24', locationId: 'L', staffIds: ['M'], bookings: [{ id: 'b', locationId: 'L', status: 'arrived', start: '2026-09-24T10:00', total: price, services: [{ serviceId: 's', price, unitPrice: 1000, qty: 1, staffId: 'M', discountPct: disc }] }], services: svc, schemes: new Map([['M', s2]]), techCardCost: () => 300 }); return r.get('M')[0].amount; };
  chk('F-09-027: 1000, себестоимость 300, 40 % → 280', run({ enabled: true, order: 'discountFirst' }) === 280, String(run({ enabled: true, order: 'discountFirst' })));
  const x = run({ enabled: true, order: 'discountFirst' }, 10), y = run({ enabled: true, order: 'costFirst' }, 10);
  chk('F-09-027: скидка 10 % — порядки различаются (240 и 252)', x === 240 && y === 252, `${x} / ${y}`);
  chk('F-09-027 выключен — вычитаются расходники 100 % (400 − 300)', run(undefined) === 100, String(run(undefined)));
  const rule = { ...D.emptyRule('biz', 'r', '2026-01-01T00:00'), serviceCostBasis: { enabled: true, order: 'discountFirst' } };
  chk('ruleAsScheme переносит себестоимость', D.ruleAsScheme(rule, 'M', 'now').serviceCostBasis?.enabled === true);
}
// F-09-005
{
  const LOC = 'loc_nuri', biz = 'biz_nuri';
  const card = st().areas.finance.bookingPayments.find(p => p.businessId === biz && p.methodKey === 'card' && !p.cancelled && p.createdAt.slice(0, 10) <= '2026-09-27' && st().core.bookings.find(b => b.id === p.bookingId && b.status === 'arrived' && b.locationId === LOC && !b.groupEventId));
  const b = st().core.bookings.find(x => x.id === card.bookingId);
  const visitDay = b.start.slice(0, 10);
  const has = async (date) => (await api.computeDay(LOC, date)).staff.some(r => r.operations.some(o => o.bookingId === b.id));
  chk('F-09-005 «дата визита»: визит в дне визита', await has(visitDay), `${b.id} ${visitDay}`);
  st().setArea('finance', f => ({ ...f, paymentMethods: { ...f.paymentMethods, [biz]: { ...f.paymentMethods[biz], card: { ...f.paymentMethods[biz].card, settlementDays: 2 } } } }));
  st().setArea('payroll', p => ({ ...p, settingsByLocation: { ...p.settingsByLocation, [LOC]: { ...p.settingsByLocation[LOC], accrualDateBasis: 'received' } } }));
  const payDay = card.createdAt.slice(0, 10);
  const d = new Date(payDay + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 2); const plus2 = d.toISOString().slice(0, 10);
  chk('F-09-005 «дата поступления», карта +2 дня: визит ушёл из дня визита', !(await has(visitDay)) || visitDay === plus2);
  chk('F-09-005 … и попал в день оплаты + 2', await has(plus2), plus2);
  // оплата картой 30.09 со сроком 2 дня → октябрь
  const endSep = await api.computePeriod(LOC, '2026-09-01', '2026-09-30');
  const cnt = (p) => p.rows.reduce((s, r) => s + r.servicesCount, 0);
  st().setArea('finance', f => ({ ...f, bookingPayments: f.bookingPayments.map(p => p.id === card.id ? { ...p, createdAt: '2026-09-30T18:00' } : p) }));
  const endSep2 = await api.computePeriod(LOC, '2026-09-01', '2026-09-30');
  const oct = await api.computeDay(LOC, '2026-10-02');
  chk('F-09-005 карта 30.09 (+2 дня) → не в сентябре, а 02.10', cnt(endSep2) < cnt(endSep) && oct.staff.some(r => r.operations.some(o => o.bookingId === b.id)), `услуг в сентябре ${cnt(endSep)} → ${cnt(endSep2)}`);
}
console.log(`\nИтого: ${pass} прошло, ${fail} не прошло`);
