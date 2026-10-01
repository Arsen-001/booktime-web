import { call } from './lib.mjs';
for (const [f, t] of [['2026-10-01', '2026-10-31'], ['2026-10-01', '2026-10-01']]) {
  const p = await call('owner', 'GET', `/v1/biz/biz_nuri/payroll/period?locationId=loc_nuri&from=${f}&to=${t}`);
  const e = p.d.rows.find((r) => r.staffId === 'st_nuri_eva');
  console.log(f, t, JSON.stringify([e.workDays, e.workHours, e.salary, e.breakdown.workday, e.breakdown.minimumTopUp, e.breakdown.minimum]));
}
