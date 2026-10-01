// F-09-111: сумма «Расчёта за день» по дням = «Расчёт за период» (части: услуги, записи, доп., рабочий день, товары)
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {}; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const api = await jiti.import(root + '/src/api/payroll.ts');
const { core, areas } = db.useDb.getState();
const FROM = '2026-09-01', TO = '2026-09-30';
for (const LOC of ['loc_nuri', 'loc_kaytsak', 'loc_atam', 'loc_vard']) {
  const period = await api.computePeriod(LOC, FROM, TO);
  const sums = new Map();
  for (let d = 1; d <= 30; d++) {
    const date = `2026-09-${String(d).padStart(2, '0')}`;
    const day = await api.computeDay(LOC, date);
    for (const r of day.staff) {
      const e = sums.get(r.staffId) ?? { services: 0, records: 0, extra: 0, workday: 0, products: 0 };
      e.services += r.servicesAmount; e.records += r.recordsAmount; e.extra += r.extraAmount; e.workday += r.workdayAmount; e.products += r.productsAmount;
      sums.set(r.staffId, e);
    }
  }
  for (const row of period.rows) {
    const b = row.breakdown, e = sums.get(row.staffId) ?? { services: 0, records: 0, extra: 0, workday: 0, products: 0 };
    const diffs = ['services', 'records', 'extra', 'workday', 'products'].filter(k => Math.abs((b[k] ?? 0) - e[k]) > 0.01).map(k => `${k}: period=${b[k]} daySum=${Math.round(e[k] * 100) / 100}`);
    if (diffs.length) console.log(LOC, row.staffId, diffs.join('; '));
  }
  console.log(LOC, 'rows', period.rows.length, 'model', areas.payroll.settingsByLocation[LOC]?.payrollModel);
}
// товары: продажи склада со sellerId в сентябре
const sales = areas.stock.operations.filter(o => o.type === 'sale' && !o.cancelledAt && !o.autoWriteoff && o.date.slice(0,10) >= FROM);
console.log('stock sales in Sept', sales.length, JSON.stringify(sales.slice(0, 2).map(o => ({ loc: o.locationId, staff: o.staffId, date: o.date, lines: o.lines.map(l => [l.goodId, l.sellerId, l.qtySale, l.unitPrice]) }))));
