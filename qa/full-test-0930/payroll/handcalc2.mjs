// Ручная сверка «за записи» (F-09-039/040), «доп. от оборота» (F-09-042), рабочего дня (F-09-036).
import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
console.warn = () => {}; console.error = () => {};
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const api = await jiti.import(root + '/src/api/payroll.ts');
const { core, areas } = db.useDb.getState();
const FROM = '2026-09-01', TO = '2026-09-30';
for (const [LOC, admin, extraStaff] of [['loc_kaytsak', 'st_kaytsak_admin', 'st_kaytsak_erik'], ['loc_nuri', 'st_nuri_admin', null]]) {
  const sc = areas.payroll.schemesByStaff[admin];
  console.log(LOC, 'records block', JSON.stringify(sc.records), 'workday', JSON.stringify(sc.workday));
  let rec = 0, recCount = 0, recAllLoc = 0;
  for (const b of core.bookings) {
    if (b.deletedAt || b.createdBy !== admin || b.status !== 'arrived') continue; // решение 01.10
    const d = b.start.slice(0, 10); if (d < FROM || d > TO) continue; // днём визита (01.10)
    for (const l of b.services) {
      const p = sc.records.perServicePayout;
      const v = p.unit === 'percent' ? l.price * l.qty * p.value / 100 : p.value;
      recAllLoc += v; if (b.locationId === LOC) { rec += v; recCount++; }
    }
  }
  const byStatus = {};
  for (const b of core.bookings) if (!b.deletedAt && b.createdBy === admin && b.createdAt.slice(0,10) >= FROM && b.createdAt.slice(0,10) <= TO) byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
  console.log(' records hand (this loc)=', rec, 'lines', recCount, 'all locs=', recAllLoc, 'by status', JSON.stringify(byStatus));
  const sched = core.schedules?.filter?.(x => x.staffId === admin) ?? [];
  console.log(' schedules of admin:', sched.length, JSON.stringify(sched[0] ?? null).slice(0, 300));
  if (extraStaff) {
    const es = areas.payroll.schemesByStaff[extraStaff].extraServiceRevenue;
    let turn = 0;
    for (const b of core.bookings) {
      if (b.locationId !== LOC || b.status !== 'arrived' || b.deletedAt) continue;
      const d = b.start.slice(0, 10); if (d < FROM || d > TO) continue;
      turn += b.services.reduce((a, l) => a + l.price * l.qty, 0);
    }
    console.log(' extra', JSON.stringify(es), 'turnover(sum of line prices, arrived)=', turn, '→', es.base === 'profit' ? turn * 0.3 * es.percent / 100 : turn * es.percent / 100);
  }
}
