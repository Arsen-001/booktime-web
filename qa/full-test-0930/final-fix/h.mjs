import { call } from './lib.mjs';
const per = await call('owner', 'GET', '/v1/biz/biz_nuri/payroll/period?locationId=loc_nuri&from=2026-10-01&to=2026-10-31');
const rows = per.d.rows ?? per.d;
const ani = (Array.isArray(rows) ? rows : []).find((r) => r.staffId === 'st_nuri_ani');
const st = await call('master', 'GET', '/v1/biz/biz_nuri/payroll/statement?locationId=loc_nuri&staffId=st_nuri_ani&from=2026-10-01&to=2026-10-31');
const app = await call('master', 'GET', '/v1/biz/biz_nuri/app-staff/st_nuri_ani/payroll-calculation?from=2026-10-01&to=2026-10-31');
const f = (d, h, ad, ah) => `${d}д/${h}ч, вперёд ${ad}д/${ah}ч`;
console.log(JSON.stringify({ period: per.s + ' ' + f(ani?.workDays, ani?.workHours, ani?.scheduledAheadDays, ani?.scheduledAheadHours) + ' salary=' + ani?.salary, statement: st.s + ' ' + f(st.d.workDays, st.d.workHours, st.d.scheduledAheadDays, st.d.scheduledAheadHours), app: app.s + ' ' + f(app.d.daysWorked, app.d.hoursWorked, app.d.scheduledAheadDays, app.d.scheduledAheadHours) }, null, 1));
