// F-09-031/111: % с продажи товара — одинаков в «Расчёте за день» и «за период»?
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {}; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const api = await jiti.import(root + '/src/api/payroll.ts');
const dom = await jiti.import(root + '/src/domain/payroll.ts');
const { core, areas } = db.useDb.getState();
const staffId = 'st_kaytsak_aram', LOC = 'loc_kaytsak';
const sc = dom.emptyScheme(staffId, '2026-09-01T00:00');
sc.productSales = { ...sc.productSales, enabled: true, defaultPayout: { unit: 'percent', value: 10 } };
await api.saveScheme(sc);
const sales = areas.stock.operations.filter(o => o.type === 'sale' && !o.cancelledAt && !o.autoWriteoff && o.locationId === LOC && o.date.slice(0,7) === '2026-09');
for (const o of sales) console.log('sale', o.date, o.staffId, JSON.stringify(o.lines.map(l => ({ g: l.goodId, seller: l.sellerId, q: l.qtySale, p: l.unitPrice, disc: l.discountPct }))));
const date = '2026-09-25';
const day = await api.computeDay(LOC, date);
const period = await api.computePeriod(LOC, date, date);
console.log('day row', JSON.stringify(day.staff.find(r => r.staffId === staffId) ?? 'нет строки'));
console.log('period row products', JSON.stringify(period.rows.find(r => r.staffId === staffId)?.breakdown?.products), 'productsAmount', period.rows.find(r => r.staffId === staffId)?.productsAmount);
// F-09-043: 3% от дневного оборота товаров филиала
const sc2 = dom.emptyScheme('st_kaytsak_erik', '2026-09-01T00:00');
sc2.extraProductRevenue = { enabled: true, percent: 3, base: 'turnover' };
await api.saveScheme(sc2);
const d2 = await api.computeDay(LOC, date); const p2 = await api.computePeriod(LOC, date, date);
const turnover = sales.filter(o => o.date.slice(0,10) === date).reduce((s, o) => s + o.lines.reduce((a, l) => a + l.unitPrice * Math.abs(l.qtySale) * (1 - (l.discountPct ?? 0) / 100), 0), 0);
console.log('F-09-043 оборот товаров', turnover, 'ожидается', turnover * 0.03, 'день extra', d2.staff.find(r => r.staffId === 'st_kaytsak_erik')?.extraAmount, 'период extra', p2.rows.find(r => r.staffId === 'st_kaytsak_erik')?.breakdown.extra);
