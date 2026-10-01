// Сверка главной с отчётами на сервере: node api-check.mjs [port=4011]
import fs from 'node:fs';
const S = JSON.parse(fs.readFileSync(new URL('./sessions.json', import.meta.url)));
const A = `http://localhost:${process.argv[2] ?? 4011}`;
const ck = (r) => S[r].map((c) => `${c.name}=${c.value}`).join('; ');
const get = async (r, p) => { const res = await fetch(A + p, { headers: { cookie: ck(r) } }); const t = await res.text(); let d; try { d = JSON.parse(t); } catch { d = t; } return { s: res.status, d }; };
const B = '/v1/biz/biz_nuri/reports';
const from = '2026-09-02', to = '2026-10-01', month = '2026-10';
const t0 = Date.now();
const home = await get('owner', `${B}/home?from=${from}&to=${to}&month=${month}&locationIds=loc_nuri`);
const ms = Date.now() - t0;
const ov = await get('owner', `${B}/overview?from=${from}&to=${to}&locationIds=loc_nuri`);
const load = await get('owner', `${B}/load?from=${from}&to=${to}&locationIds=loc_nuri`);
const ovMonth = await get('owner', `${B}/overview?from=2026-10-01&to=2026-10-01&locationIds=loc_nuri`);
const h = home.d;
console.log(JSON.stringify({
  status: home.s, ms,
  plan: h.plan, planVsOverviewMonth: ovMonth.d.sales?.total?.value,
  load: h.load, loadReport: { worked: load.d.totalWorkedHours, scheduled: load.d.totalScheduledHours },
  rebooking: { ...h.rebooking, notRebooked: h.rebooking?.notRebooked?.length, first: h.rebooking?.notRebooked?.[0] }, overviewExtras: ov.d.extras,
  noShow: h.noShow, overviewNoShow: ov.d.occupancy?.noShow, avgOcc: ov.d.occupancy?.avgOccupancyPct,
  due: { count: h.due?.count, first: h.due?.clients?.[0] },
  mailings: h.mailings, setup: h.setup, isEmpty: h.isEmpty,
  master: (await get('master', `${B}/home?from=${from}&to=${to}&month=${month}`)).s,
  admin: (await get('admin', `${B}/home?from=${from}&to=${to}&month=${month}`)).s,
  bad: (await get('owner', `${B}/home?from=2026-09-31&to=${to}&month=${month}`)).s,
}, null, 1));
