// Сид 01.10: прошедшие визиты «Пришёл» за 2 недели оплачены, кроме ~5 на бизнес; предоплата — своя операция, без дубля
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const fin = await jiti.import(root + '/src/api/finance.ts');
const S = db.useDb.getState();
let pass = 0, fail = 0; const check = (n, ok, i = '') => { ok ? pass++ : fail++; console.log(ok ? 'PASS' : 'FAIL', n, i); };
for (const b of S.core.businesses) {
  const rows = await fin.listUnpaidVisits(b.id);
  check(`${b.id}: «Пришли, но не оплатили» 1…5`, rows.length <= 5 && (rows.length >= 1 || /empty/.test(b.id)), String(rows.length));
}
// Предоплаченные визиты: сумма операций по визиту = сумме визита (предоплата + остаток), ни копейки сверх
const ops = S.areas.finance.operations.filter((o) => o.source === 'booking' && o.kind === 'income' && !o.cancelled && o.refId);
const byVisit = new Map(); for (const o of ops) byVisit.set(o.refId, (byVisit.get(o.refId) ?? 0) + o.amount);
const pre = S.core.bookings.filter((b) => b.prepayment?.paid && byVisit.has(b.id));
const bad = pre.filter((b) => byVisit.get(b.id) !== b.total);
check('предоплаченные визиты: предоплата + остаток = сумма визита', pre.length > 0 && bad.length === 0, `${pre.length} визитов, расхождений ${bad.length}`);
const s = await fin.getBookingPaymentSummary(pre[0].businessId, pre[0].id);
check('окно оплаты предоплаченного визита: «Оплачено», due 0', s.status === 'paid' && s.due === 0, `${s.status} ${s.due}`);
console.log(`ИТОГ ${pass}/${pass + fail}`); process.exit(0);
