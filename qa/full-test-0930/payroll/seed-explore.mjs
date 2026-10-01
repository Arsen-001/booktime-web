import { createJiti } from 'jiti';
const root = '/Users/arsen/WebstormProjects/booking-platform';
const jiti = createJiti(import.meta.url, { alias: { '@docs': root + '/docs', '@messages': root + '/messages', '@': root + '/src' }, jsx: true });
const db = await jiti.import(root + '/src/mock/db.ts');
await db.bootDb();
const s = db.useDb.getState();
const core = s.core;
const biz = core.businesses.filter(b => b.kind === 'salon' && !b.networkId);
console.log('salons', biz.map(b => [b.id, b.name?.ru ?? b.name, b.sphereIds.join(','), b.locationIds.join(',')]));
const pr = s.areas.payroll;
console.log('payroll keys', Object.keys(pr));
for (const [sid, sc] of Object.entries(pr.schemesByStaff)) {
  const st = core.staff.find(x => x.id === sid);
  const ps = sc.personalServices;
  console.log(sid, st?.name?.ru ?? st?.name, st?.businessId, st?.status, st?.role, '| svc', ps.enabled, JSON.stringify(ps.defaultPayout), 'ovr', ps.overrides.length, 'cons', ps.consumables.mode, ps.demoConsumablesPercent, 'loy', ps.loyaltyAdjustment.enabled, '| prod', sc.productSales.enabled, JSON.stringify(sc.productSales.defaultPayout), '| wd', sc.workday.enabled, sc.workday.baseAmount, sc.workday.basePeriod, JSON.stringify(sc.workday.guaranteedMinimum), '| rec', sc.records.enabled, '| extra', sc.extraServiceRevenue.enabled, sc.extraServiceRevenue.percent, 'eff', sc.effectiveFrom, 'hist', sc.history?.length ?? 0, 'created', sc.createdAt);
}
console.log('settings', JSON.stringify(pr.settingsByLocation));
console.log('now', new Date().toISOString(), 'seededAt', s.meta.seededAt);
