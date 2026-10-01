import { start } from './h.mjs';
const t = await start();
try {
  await t.go('owner', '/biz/stock');
  const db = await t.db();
  const s = db.areas?.stock ?? db.stock ?? db;
  console.log(Object.keys(db));
  const st = db.areas ? db.areas.stock : null;
  const S = st || Object.values(db).find(v => v && v.goods);
  const biz = S.goods[0].businessId;
  for (const g of S.goods.filter(g=>g.businessId===biz)) {
    const ops = S.operations.filter(o=>o.businessId===biz && o.lines.some(l=>l.goodId===g.id));
    const byType = {};
    for (const o of ops) for (const l of o.lines) if (l.goodId===g.id) byType[o.type+(o.auto?'-auto':'')+(o.bookingId?'-bk':'')] = +( (byType[o.type+(o.auto?'-auto':'')+(o.bookingId?'-bk':'')]||0) + l.qtySale).toFixed(3);
    console.log(g.name, g.locationId, 'crit', g.criticalStock, 'exp', g.expiryDate, JSON.stringify(byType));
  }
  console.log('op sample', JSON.stringify(S.operations.find(o=>o.bookingId)||S.operations[0]).slice(0,600));
  console.log('ERR', t.errors.slice(0,5));
} finally { await t.end(); }
