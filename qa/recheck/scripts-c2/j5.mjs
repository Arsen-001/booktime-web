import { start, stop, open, db } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/journal?date=2026-09-29`, { device: 'desktop' });
const d = await db(page);
for (const f of ['2026-10-13','2026-10-16']) console.log(f, JSON.stringify(d.core.bookings.filter(b=>b.staffId==='st_nuri_ani' && b.start.startsWith(f) && !b.deletedAt).map(b=>[b.start,b.durationMin,b.status])));
const b = d.core.bookings.find(x=>x.id==='bk_1937'); console.log(JSON.stringify(b));
await stop();
