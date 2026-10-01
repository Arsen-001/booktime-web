// Сервер: оплата → частичный возврат → ещё возврат → отмена платежа (итог кассы 0); полный возврат → не оплачен
import { call, sql, CLIENT, remember } from './lib.mjs';
const out = {};
const mk = async (start) => { const c = await call('owner', 'POST', '/v1/biz/biz_nuri/bookings', { staffId: 'st_nuri_ani', clientId: CLIENT, locationId: 'loc_nuri', start, durationMin: 45, status: 'arrived', services: [{ serviceId: 'sv_nuri_classic', qty: 1, price: 5000, staffId: 'st_nuri_ani', durationMin: 45 }], source: 'journal' }); remember('booking', c.d.id); return c.d.id; };
const F = (bk) => `/v1/biz/biz_nuri/finance/bookings/${bk}/payments`;
const state = async (bk) => {
  const s = (await call('owner', 'GET', F(bk))).d;
  const ex = (await call('owner', 'POST', '/v1/biz/biz_nuri/bookings/extras', { ids: [bk] })).d[bk];
  const ops = sql(`select concat(kind,':',amount,':',cancelled) from fin_ops where ref_id='${bk}' order by created_at`).split('\n').filter(Boolean);
  const net = sql(`select coalesce(sum(case when kind='income' then amount else -amount end),0) from fin_ops where ref_id='${bk}' and cancelled=0`);
  return { paid: s.paidAmount, due: s.due, status: s.status, extrasPaid: ex.paidAmount, extrasLines: (ex.payments ?? []).map((p) => p.amount), ops, cashNet: net };
};
const bk = await mk('2026-10-09T20:00');
const p = await call('owner', 'POST', F(bk), { mode: 'split', parts: [{ methodKey: 'cash', amount: 5000 }] });
const line = p.d.moneyLines[0].id;
out.paid = await state(bk);
out.r1 = (await call('owner', 'POST', `/v1/biz/biz_nuri/finance/payments/${line}/refund`, { amount: 1000, reason: '' })).s;
out.afterRefund1000 = await state(bk);
out.r2 = (await call('owner', 'POST', `/v1/biz/biz_nuri/finance/payments/${line}/refund`, { amount: 500, reason: '' })).s;
out.afterRefund500 = await state(bk);
const p2 = await call('owner', 'POST', F(bk), { mode: 'split', parts: [{ methodKey: 'cash', amount: 1500 }] });
out.repay = p2.s; out.afterRepay = await state(bk);
out.cancel = (await call('owner', 'DELETE', `/v1/biz/biz_nuri/finance/payments/${line}`)).s;
out.afterCancelFirst = await state(bk);
const bk2 = await mk('2026-10-09T21:00');
const q = await call('owner', 'POST', F(bk2), { mode: 'quick', methodKey: 'cash' });
out.full = (await call('owner', 'POST', `/v1/biz/biz_nuri/finance/payments/${q.d.moneyLines[0].id}/refund`, { amount: 5000, reason: 'qa' })).s;
out.afterFullRefund = await state(bk2);
console.log(JSON.stringify(out, null, 1));
