import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
const { page } = await open('owner', '/biz/journal', { device: 'desktop' });
const d = await db(page);
for (const sid of ['st_nuri_ani','st_nuri_mariam','st_nuri_sona','st_nuri_gayane']) {
const sc = d.core.schedules.filter(s=>s.staffId===sid);
log(sid, JSON.stringify(sc.map(s=>({loc:s.locationId, wp:s.workplace, fri:s.week[4], ov:s.overrides['2026-09-25'], w: s.week}))).slice(0,600));
}
log('marks', JSON.stringify(d.core.calendarMarks.filter(m=>m.staffId==='st_nuri_ani' && m.date==='2026-09-25')));
log(JSON.stringify(d.core.staff.filter(s=>s.businessId==='biz_nuri').map(s=>[s.id,s.name,s.calendarMode])));
await stop();
