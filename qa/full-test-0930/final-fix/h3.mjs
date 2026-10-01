import { call } from './lib.mjs';
const p = await call('owner', 'GET', '/v1/biz/biz_nuri/payroll/period?locationId=loc_nuri&from=2026-10-01&to=2026-10-31');
const l = p.d.rows.find((r) => r.staffId === 'st_nuri_admin');
const a = p.d.rows.find((r) => r.staffId === 'st_nuri_ani');
const st = await call('master', 'GET', '/v1/biz/biz_nuri/payroll/statement?locationId=loc_nuri&staffId=st_nuri_ani&from=2026-10-01&to=2026-10-31');
const sept = await call('owner', 'GET', '/v1/biz/biz_nuri/payroll/period?locationId=loc_nuri&from=2026-09-01&to=2026-09-30');
const ls = sept.d.rows.find((r) => r.staffId === 'st_nuri_admin');
console.log(JSON.stringify({ lilitOct: [l.salary, l.breakdown.workday, l.breakdown.minimum], aniOct: [a.salary, 'statement', st.d.salary, st.d.total], lilitSeptWholeMonth: [ls?.salary, ls?.breakdown.workday, ls?.breakdown.minimumTopUp, ls?.breakdown.minimum] }, null, 1));
