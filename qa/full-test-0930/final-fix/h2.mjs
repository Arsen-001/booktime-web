import { call } from './lib.mjs';
const q = '/v1/biz/biz_nuri/payroll/period?locationId=loc_nuri&from=2026-10-01&to=2026-10-31';
const a = await call('owner', 'GET', q);
process.env.API_URL = 'http://localhost:4010';
const { call: call10 } = await import('./lib.mjs?x=1');
const b = await call10('owner', 'GET', q);
const rows = (d) => (d.rows ?? d);
for (const r of rows(a.d)) { const o = rows(b.d).find((x) => x.staffId === r.staffId); console.log(r.staffId, '4011', r.workDays, r.workHours, r.salary, '| 4010', o?.workDays, o?.workHours, o?.salary); }
