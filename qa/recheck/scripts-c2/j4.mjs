import { start, stop, open, as, reload, text, shot, db, toasts, btnTexts } from './lib.mjs';
await start();
const DATE='2026-09-29';
const { page } = await open('owner', `/biz/journal?date=${DATE}`, { device: 'desktop' });
let d = await db(page); const n0 = d.core.bookings.length;
await page.locator('[data-testid="booking-block"]', { hasText: '15:45' }).first().click(); await page.waitForTimeout(1500);
const win = page.locator('[role=dialog]').last();
await win.getByRole('button', { name: 'Повторение записи' }).click(); await page.waitForTimeout(800);
console.log('REPEAT', (await win.innerText()).replace(/\n+/g,' | ').slice(0,1500));
await shot(page, 'j4-repeat-form');
await win.getByRole('button', { name: 'Пт', exact: true }).click().catch(e=>console.log('no Пт'));
await page.waitForTimeout(300);
console.log('REPEAT2', (await win.innerText()).replace(/\n+/g,' | ').slice(0,1500));
await win.getByRole('button', { name: 'Создать повторения' }).click(); await page.waitForTimeout(2500);
console.log('toasts', await toasts(page));
d = await db(page); const nb = d.core.bookings.slice(n0);
console.log('created', JSON.stringify(nb.map(b=>[b.id,b.start,b.durationMin,b.staffId,b.seriesId,b.clientId])));
const src = d.core.bookings.find(b=>b.staffId==='st_nuri_ani' && b.start==='2026-09-29T15:45');
console.log('src', src.id, src.start, src.durationMin, src.clientId, src.seriesId);
// For each Friday from 2 Oct, check whether Ani had overlap at 15:45
for (const f of ['2026-10-02','2026-10-09','2026-10-16','2026-10-23','2026-10-30']) {
  const ov = d.core.bookings.filter(b=>b.staffId==='st_nuri_ani' && b.start.startsWith(f) && !b.deletedAt && !['cancelled_by_client','cancelled_by_master','no_show'].includes(b.status) && !nb.some(x=>x.id===b.id)).map(b=>[b.start,b.durationMin]);
  const sch = d.core.schedules.filter(s=>s.staffId==='st_nuri_ani').map(s=>JSON.stringify(s.overrides[f] ?? s.week[4]));
  console.log(f, 'existing', JSON.stringify(ov), 'hours', sch.join(' '));
}
await stop();
