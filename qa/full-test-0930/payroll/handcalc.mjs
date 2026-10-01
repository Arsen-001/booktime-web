// Ручная сверка: независимый пересчёт зарплаты за период по визитам/оплатам сида и сравнение с api computePeriod.
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
const origWarn = console.warn; console.warn = () => {}; const origErr = console.error; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const api = await jiti.import(root + '/src/api/payroll.ts');
const stockApi = await jiti.import(root + '/src/api/stock.ts');
console.warn = origWarn; console.error = origErr;
const s = db.useDb.getState();
const core = s.core, areas = s.areas;
const LOC = process.argv[2] || 'loc_nuri';
const FROM = process.argv[3] || '2026-09-01', TO = process.argv[4] || '2026-09-30';
const loc = core.locations.find(l => l.id === LOC);
const r2 = n => Math.round(n * 100) / 100;
const fin = areas.finance;
const payByBooking = new Map();
for (const p of fin.bookingPayments) { if (p.businessId !== loc.businessId) continue; (payByBooking.get(p.bookingId) ?? payByBooking.set(p.bookingId, []).get(p.bookingId)).push(p); }
const techCards = areas.stock.techCards.filter(c => c.locationId === LOC);
const period = await api.computePeriod(LOC, FROM, TO);
const nameOf = id => { const st = core.staff.find(x => x.id === id); return st?.name?.ru ?? st?.name ?? id; };
console.log(`== ${LOC} ${FROM}..${TO}; bookings arrived in loc/range:`,
  core.bookings.filter(b => b.locationId === LOC && b.status === 'arrived' && !b.deletedAt && b.start.slice(0,10) >= FROM && b.start.slice(0,10) <= TO).length);
for (const row of period.rows) {
  const sc = areas.payroll.schemesByStaff[row.staffId];
  // независимый пересчёт услуг: визиты «пришёл», не удалены, не групповые, в филиале, строки этого мастера
  let revenue = 0, pay = 0, cnt = 0, unpaidVisits = 0, techUsed = 0, paidSum = 0;
  for (const b of core.bookings) {
    if (b.locationId !== LOC || b.status !== 'arrived' || b.deletedAt || b.groupEventId) continue;
    const d = b.start.slice(0, 10); if (d < FROM || d > TO) continue;
    const bookingLines = b.services.reduce((a, l) => a + l.price * l.qty, 0) || 1;
    const pays = (payByBooking.get(b.id) ?? []).filter(p => !p.cancelled);
    const paid = pays.reduce((a, p) => a + (p.refunded ? 0 : p.amount), 0);
    for (const l of b.services) {
      if (l.staffId !== row.staffId) continue;
      cnt++;
      const lineTotal = l.price * l.qty; revenue += lineTotal;
      if (!sc?.personalServices.enabled) continue;
      const rate = sc.personalServices.defaultPayout; // overrides=0 в сиде
      const unpaidShare = Math.max(0, b.total - paid) * (lineTotal / bookingLines);
      const base = Math.max(0, lineTotal - unpaidShare);
      let amount = rate.unit === 'percent' ? base * rate.value / 100 : rate.value;
      const mode = sc.personalServices.consumables.mode;
      if (mode !== 'off') {
        const card = techCards.find(c => c.serviceId === l.serviceId && c.staffId === row.staffId);
        let cost = card ? null : (l.unitPrice ?? l.price) * l.qty * (sc.personalServices.demoConsumablesPercent ?? 0) / 100;
        if (card) { techUsed++; cost = card.lines.reduce((a, x) => a + x.qtyWriteoff * stockApi.costPriceAt(loc.businessId, x.goodId, d), 0) * l.qty; }
        if (process.env.MODE === 'code' && mode === 'full') { amount = Math.max(0, (base - cost) * rate.value / 100) + (rate.value/100*0); pay += amount; continue; }
        // ТЗ F-09-024: «100%» — вычесть всю стоимость; «пропорционально» — стоимость × ставку
        const ded = mode === 'full' ? cost : cost * rate.value / 100;
        amount = Math.max(0, amount - ded);
      }
      pay += amount;
    }
  }
  const b = row.breakdown;
  console.log(`${nameOf(row.staffId).padEnd(18)} rev api=${row.servicesAmount} hand=${r2(revenue)} | services pay api=${b.services} hand(ТЗ)=${r2(pay)} | cnt api=${row.servicesCount} hand=${cnt} | wd=${b.workday} rec=${b.records} extra=${b.extra} min+=${b.minimumTopUp} salary=${row.salary} toPay=${b.toPay} bon=${b.bonuses} pen=${b.penalties} unpaidV=${b.unpaidVisits} tech=${techUsed} cons=${sc?.personalServices.consumables.mode}`);
}
// распределение неоплаченных визитов по дням
const byDay = {};
for (const b of core.bookings) {
  if (b.locationId !== LOC || b.status !== 'arrived' || b.deletedAt) continue;
  const d = b.start.slice(0, 10); if (d < FROM || d > TO) continue;
  const paid = (payByBooking.get(b.id) ?? []).filter(p => !p.cancelled).reduce((a, p) => a + p.amount, 0);
  const k = paid >= b.total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
  (byDay[d] ??= { paid: 0, partial: 0, unpaid: 0 })[k]++;
}
console.log(JSON.stringify(byDay));
console.log('payments total in biz', fin.bookingPayments.filter(p => p.businessId === loc.businessId).length, 'sample', JSON.stringify(fin.bookingPayments.find(p => p.businessId === loc.businessId)));
