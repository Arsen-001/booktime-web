// Предоплата на уровне мок-api (node + jiti): окно просит остаток, быстрая/раздельная оплата проводит только остаток,
// полностью предоплаченный визит не в «неоплаченных» и «долгах»
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const fin = await jiti.import(root + '/src/api/finance.ts');
const S = () => db.useDb.getState();
let pass = 0, fail = 0;
const check = (n, ok, info = '') => { ok ? pass++ : fail++; console.log(ok ? 'PASS' : 'FAIL', n, info); };
const paidIds = new Set(S().areas.finance.bookingPayments.map((p) => p.bookingId));
const cands = S().core.bookings.filter((b) => b.prepayment?.paid && !b.deletedAt && b.prepayment.amount < b.total && ['scheduled', 'client_confirmed', 'arrived'].includes(b.status) && !paidIds.has(b.id) && !(b.goods?.length));
console.log('candidates', cands.length);
const [b1, b2] = cands;
const biz = b1.businessId;
const sumLines = (id) => S().areas.finance.bookingPayments.filter((p) => p.bookingId === id && !p.cancelled).reduce((s, p) => s + p.amount, 0);
// 1. Быстрая оплата
let s = await fin.getBookingPaymentSummary(biz, b1.id);
const rem1 = b1.total - b1.prepayment.amount;
check('сводка: due = остаток', s.due === rem1, `due ${s.due}, total ${b1.total}, prepaid ${s.prepaid}`);
check('сводка: prepaid в сводке', s.prepaid === b1.prepayment.amount);
const tiles = await fin.listPaymentTiles?.(biz).catch(() => null);
const settings = await fin.getPaymentMethodsSettings?.(biz).catch(() => null);
const key = 'cash';
try {
  s = await fin.payBookingQuick(biz, b1.id, key);
  check('быстрая оплата: проведён только остаток', sumLines(b1.id) === rem1, `строки ${sumLines(b1.id)}, ждали ${rem1}`);
  check('быстрая оплата: статус paid, due 0', s.status === 'paid' && s.due === 0, `${s.status} ${s.due}`);
} catch (e) { check('быстрая оплата', false, e.message); }
try { await fin.payBookingQuick(biz, b1.id, key); check('повторная быстрая оплата отклонена', false); } catch (e) { check('повторная быстрая оплата отклонена', e.message === 'already_paid', e.message); }
// 2. Раздельная: сверх остатка — отказ, ровно остаток — ок
if (b2) {
  const rem2 = b2.total - b2.prepayment.amount;
  try { await fin.payBookingSplit(b2.businessId, b2.id, [{ methodKey: key, amount: b2.total }]); check('раздельная сверх остатка отклонена', false, `проведено ${sumLines(b2.id)}`); } catch (e) { check('раздельная сверх остатка отклонена', /amount_exceeds_due/.test(e.code ?? e.message), e.code ?? e.message); }
  s = await fin.payBookingSplit(b2.businessId, b2.id, [{ methodKey: key, amount: rem2 }]);
  check('раздельная на остаток: оплачено', s.status === 'paid' && sumLines(b2.id) === rem2, `${s.status} ${sumLines(b2.id)}/${rem2}`);
}
// 3. Полностью предоплаченный «пришёл» — не в неоплаченных и долгах
const unpaidBefore = await fin.listUnpaidVisits(biz);
const target = S().core.bookings.find((b) => b.businessId === biz && unpaidBefore.some((r) => r.bookingId === b.id) && b.clientId && !(b.goods?.length) && S().areas.finance.bookingPayments.every((p) => p.bookingId !== b.id));
db.useDb.getState().setCore((c) => ({ ...c, bookings: c.bookings.map((b) => (b.id === target.id ? { ...b, prepayment: { amount: b.total, paid: true, full: true } } : b)) }));
const unpaidAfter = await fin.listUnpaidVisits(biz);
check('полная предоплата: визит ушёл из «Пришли, но не оплатили»', !unpaidAfter.some((r) => r.bookingId === target.id) && unpaidAfter.length === unpaidBefore.length - 1, `${unpaidBefore.length} → ${unpaidAfter.length}`);
const debts = await fin.listClientDebtVisits(biz, target.clientId, 'unpaid');
check('полная предоплата: нет в «Визиты с долгом»', !debts.some((r) => r.bookingId === target.id));
s = await fin.getBookingPaymentSummary(biz, target.id);
check('полная предоплата: статус paid', s.status === 'paid' && s.due === 0, `${s.status} ${s.due}`);
try { await fin.payBookingQuick(biz, target.id, key); check('полная предоплата: оплатить нельзя', false); } catch (e) { check('полная предоплата: оплатить нельзя', e.message === 'already_paid', e.message); }
const rc = await fin.getBookingReceiptData(biz, b1.id);
const rcPaid = rc.paymentLines.reduce((a, l) => a + l.amount, 0);
check('чек: «Предоплата» строкой, оплачено = итого', rc.paymentLines.some((l) => l.label === 'Предоплата') && rcPaid === rc.total, `${rcPaid}/${rc.total}`);
if (target.clientId) {
  const ms = await fin.getClientMoneySummary(biz, target.clientId);
  const debtRows = await fin.listClientDebtVisits(biz, target.clientId, 'all');
  const row = debtRows.find((r) => r.bookingId === target.id);
  check('клиент: визит с полной предоплатой — оплачено = сумма', row && row.paid === row.total && row.due === 0, JSON.stringify(row));
  console.log('  client money', JSON.stringify(ms));
}
console.log(`ИТОГ ${pass}/${pass + fail}`);
process.exit(0);
