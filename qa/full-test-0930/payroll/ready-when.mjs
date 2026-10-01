// «Готово, когда» ТЗ 09-payroll — прямыми вызовами движка на синтетических визитах (каждая проверка может провалиться).
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
const D = await jiti.import(root + '/src/domain/payroll.ts');
let pass = 0, fail = 0;
const eq = (id, name, got, exp) => { const ok = Math.abs(got - exp) < 0.005; ok ? pass++ : fail++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${id} ${name}: получено ${got}, ожидалось ${exp}`); };
const date = '2026-09-24';
const svc = (id, price) => ({ id, name: { ru: id }, priceMin: price, categoryId: 'cat1' });
const bk = (id, lines, extra = {}) => ({ id, locationId: 'L', status: 'arrived', start: `${date}T12:00`, total: lines.reduce((s, l) => s + l.price * l.qty, 0), services: lines, ...extra });
const line = (serviceId, price, staffId = 'M', extra = {}) => ({ serviceId, price, unitPrice: price, qty: 1, staffId, ...extra });
function scheme(ps = {}) { const s = D.emptyScheme('M', '2026-01-01T00:00'); s.personalServices = { ...s.personalServices, enabled: true, defaultPayout: { unit: 'percent', value: 40 }, ...ps }; return s; }
function run(bookings, sch, opts = {}) {
  const schemes = new Map(Object.entries(sch));
  const res = D.computeServicesForDay({ date, locationId: 'L', staffIds: Object.keys(sch), bookings, services: [svc('ewf', 234), svc('test', 500), svc('s1000', 1000)], schemes, ...opts });
  const out = {}; for (const [k, ops] of res) out[k] = ops.reduce((s, o) => s + o.amount, 0); return { out, res };
}
// F-09-017/106: 40% от 234 = 93.6
eq('F-09-106', '40% от 234', run([bk('b1', [line('ewf', 234)])], { M: scheme() }).out.M, 93.6);
// F-09-026: 40% от 500 = 200 − расходники 300 → 0; соседняя услуга 93.6 целиком (100% списание, техкарта 300 у test)
{
  const r = run([bk('b1', [line('ewf', 234), line('test', 500)])], { M: scheme({ consumables: { mode: 'full', applyClientDiscount: false } }) }, { techCardCost: (sid) => sid === 'test' ? 300 : undefined });
  eq('F-09-026', 'ewf 93.6 + test 0', r.out.M, 93.6);
}
// F-09-024: материалы 10, 100% → −10; пропорционально при 60% → −6 (услуга 1000, ставка 60% → 600)
eq('F-09-024', '100%: 600 − 10', run([bk('b1', [line('s1000', 1000)])], { M: scheme({ defaultPayout: { unit: 'percent', value: 60 }, consumables: { mode: 'full', applyClientDiscount: false } }) }, { techCardCost: () => 10 }).out.M, 590);
eq('F-09-024', 'пропорц.: 600 − 6', run([bk('b1', [line('s1000', 1000)])], { M: scheme({ defaultPayout: { unit: 'percent', value: 60 }, consumables: { mode: 'proportional', applyClientDiscount: false } }) }, { techCardCost: () => 10 }).out.M, 594);
// F-09-024: у ассистента ничего не вычитается; у мастера — вычитается
{
  const sch = scheme({ defaultPayout: { unit: 'percent', value: 50 }, consumables: { mode: 'full', applyClientDiscount: false }, assistRates: { withoutAssistant: { unit: 'percent', value: 50 }, asAssistant: { unit: 'percent', value: 10 } } });
  const r = run([bk('b1', [line('s1000', 1000)])], { M: sch, A: scheme() }, { techCardCost: () => 10, assistantsForLine: () => [{ staffId: 'A', sharePct: 100 }] });
  eq('F-09-024', 'мастер 50%−10%(асс.)−10 расх.', r.out.M, 390);
  eq('F-09-024', 'ассистент 10% без вычета', r.out.A, 100);
}
// F-09-025: скидка 10%, применять → 9; не применять → 10
eq('F-09-025', 'применять скидку', D.consumablesDeduction(1000, 10, { demoConsumablesPercent: 0, consumables: { mode: 'full', applyClientDiscount: true } }, { unit: 'percent', value: 60 }, 10), 9);
eq('F-09-025', 'пропорц.+скидка 5.4', D.consumablesDeduction(1000, 10, { demoConsumablesPercent: 0, consumables: { mode: 'proportional', applyClientDiscount: true } }, { unit: 'percent', value: 60 }, 10), 5.4);
eq('F-09-025', 'не применять', D.consumablesDeduction(1000, 10, { demoConsumablesPercent: 0, consumables: { mode: 'full', applyClientDiscount: false } }, { unit: 'percent', value: 60 }, 10), 10);
// F-09-017: визит «Ожидание» не входит; сумма — оплаченная (неоплачено 500 из 734 → база 234)
eq('F-09-017', 'визит scheduled не входит', run([bk('b1', [line('ewf', 234)], { status: 'scheduled' })], { M: scheme() }).out.M, 0);
eq('F-09-006', 'отмена платежа 500 из 734 → база 234', run([bk('b1', [line('ewf', 234), line('test', 500)])], { M: scheme() }, { unpaidForBooking: () => 500 }).out.M, 93.6);
eq('F-09-006', 'удалённый визит не входит', run([bk('b1', [line('ewf', 234)], { deletedAt: '2026-09-24T13:00' })], { M: scheme() }).out.M, 0);
eq('F-09-006', 'частичный возврат 1000 из 5000 → база 4000', run([bk('b1', [{ ...line('s1000', 5000) }])], { M: scheme() }, { unpaidForBooking: () => 1000 }).out.M, 1600);
// F-09-112: услуга считается тому, кто в строке
{ const r = run([bk('b1', [line('ewf', 234, 'M'), line('test', 500, 'X')])], { M: scheme(), X: scheme() }); eq('F-09-112', 'строка X → X', r.out.X, 200); eq('F-09-112', 'строка M → M', r.out.M, 93.6); }
// F-09-047
{
  const rates = { withoutAssistant: { unit: 'percent', value: 50 }, asAssistant: { unit: 'percent', value: 10 } };
  const r = D.computeAssistSplit(1000, rates, [{ staffId: 'A', sharePct: 100 }, { staffId: 'B', sharePct: 100 }]);
  eq('F-09-047', 'мастер 30% от 1000', r.masterAmount, 300); eq('F-09-047', 'ассистент 10%', r.assistants[0].amount, 100);
  const r2 = D.computeAssistSplit(1000, { ...rates, withAssistant: { unit: 'percent', value: 40 } }, [{ staffId: 'A', sharePct: 100 }]);
  eq('F-09-047', '«с ассистентом» 40% → 400', r2.masterAmount, 400);
}
// F-09-007
{
  const v1 = D.splitBankCommission({ commissionAmount: 10, masterRatePct: 40, assistantRatesPct: [10] }, 'staffAssistBusiness');
  eq('F-09-007', 'вар.1 мастер 4', v1.master, 4); eq('F-09-007', 'вар.1 асс. 1', v1.assistants[0], 1); eq('F-09-007', 'вар.1 бизнес 5', v1.business, 5);
  const v3 = D.splitBankCommission({ commissionAmount: 10, masterRatePct: 40, assistantRatesPct: [10] }, 'staffAssist');
  eq('F-09-007', 'вар.3 мастер 8', v3.master, 8); eq('F-09-007', 'вар.3 бизнес 0', v3.business, 0);
  eq('F-09-007', 'вар.4 всё мастеру', D.splitBankCommission({ commissionAmount: 10, masterRatePct: 40, assistantRatesPct: [] }, 'staffOnly').master, 10);
  eq('F-09-007', 'по умолчанию зарплата не меняется', run([bk('b1', [line('s1000', 1000)])], { M: scheme() }, { cardCommissionForBooking: () => 20 }).out.M, 400);
  eq('F-09-007', 'вар.2 в движке: 400 − 40% от 20', run([bk('b1', [line('s1000', 1000)])], { M: scheme() }, { cardCommissionForBooking: () => 20, bankCommissionSplit: 'staffBusiness' }).out.M, 392);
}
// F-09-021 пример 1600 / 50% / LP 80 / 22%
eq('F-09-021', 'учитывать LP', D.personalServiceLoyaltyPayout(1600, 80, { unit: 'percent', value: 50 }, { unit: 'percent', value: 22 }, true), 817.6);
eq('F-09-021', 'не учитывать LP', D.personalServiceLoyaltyPayout(1600, 80, { unit: 'percent', value: 50 }, { unit: 'percent', value: 22 }, false), 777.6);
// F-09-027
eq('F-09-027', '1000/300/40% → 280', D.serviceCostBasisPayout(1000, 0, 300, { enabled: true, order: 'discountFirst' }, { unit: 'percent', value: 40 }), 280);
{ const a = D.serviceCostBasisPayout(1000, 10, 300, { enabled: true, order: 'discountFirst' }, { unit: 'percent', value: 40 }); const b = D.serviceCostBasisPayout(1000, 10, 300, { enabled: true, order: 'costFirst' }, { unit: 'percent', value: 40 }); eq('F-09-027', 'порядки различаются (a≠b)', a !== b ? 1 : 0, 1); }
// F-09-037
console.log('     F-09-037 01.09–30.09 →', JSON.stringify(D.qualifyingMonthlySalaryMonths('2026-09-01', '2026-09-30')), '; 02.09–01.10 →', JSON.stringify(D.qualifyingMonthlySalaryMonths('2026-09-02', '2026-10-01')));
eq('F-09-037', '01.09–30.09 = [08]', D.qualifyingMonthlySalaryMonths('2026-09-01', '2026-09-30').join() === '2026-08' ? 1 : 0, 1);
eq('F-09-037', '02.09–01.10 = [09]', D.qualifyingMonthlySalaryMonths('2026-09-02', '2026-10-01').join() === '2026-09' ? 1 : 0, 1);
eq('F-09-037', 'без часов — нет оклада', D.monthlySalaryQualifies('2026-09', 0, '2026-08-01') ? 1 : 0, 0);
// F-09-038
const min = { enabled: true, amount: 150000, period: 'month' };
eq('F-09-038', '120к → 150к', D.applyMonthlyGuaranteedMinimum(120000, min, '2026-09-01', '2026-09-30'), 150000);
eq('F-09-038', '180к → 180к', D.applyMonthlyGuaranteedMinimum(180000, min, '2026-09-01', '2026-09-30'), 180000);
eq('F-09-038', '05.09–30.09 без минимума', D.applyMonthlyGuaranteedMinimum(120000, min, '2026-09-05', '2026-09-30'), 120000);
// F-09-034
{ const a = D.productSaleBase(1000, 10, 30, { enabled: true, order: 'discountFirst' }); const b = D.productSaleBase(1000, 10, 30, { enabled: true, order: 'costFirst' }); console.log('     F-09-034 скидка→себест.', a, ' себест.→скидка', b); }
// F-09-029/030 групповые
{
  const g = { enabled: true, minPayoutOn: true, minPayout: { unit: 'amount', value: 1000 }, atLeastOneOn: true, atLeastOnePayout: { unit: 'amount', value: 500 }, perAttendeeMode: 'aboveThreshold', threshold: 3 };
  eq('F-09-030', '5 пришли, порог 3, 10% от 2000 → 1000+500+2×200', D.computeGroupEventPayout(5, 2000, g, { unit: 'percent', value: 10 }), 1900);
  eq('F-09-029', 'никто не пришёл → только минимум', D.computeGroupEventPayout(0, 2000, g, { unit: 'percent', value: 10 }), 1000);
}
// F-09-042
eq('F-09-042', '5% от оборота 10000', D.extraRevenueAmount(10000, { enabled: true, percent: 5, base: 'turnover' }), 500);
eq('F-09-042', '10% от прибыли (10000−7000)', D.extraRevenueAmount(10000, { enabled: true, percent: 10, base: 'profit' }), 300);
// F-09-106 диапазоны
eq('F-09-106', '120% отклоняется', D.checkPayoutValue({ unit: 'percent', value: 120 }).valid ? 1 : 0, 0);
eq('F-09-106', '−5 отклоняется', D.checkPayoutValue({ unit: 'amount', value: -5 }).valid ? 1 : 0, 0);
console.log(`\nИтого: ${pass} прошло, ${fail} не прошло`);
