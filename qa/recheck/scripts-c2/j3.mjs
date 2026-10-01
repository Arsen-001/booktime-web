import { start, stop, open, as, reload, text, shot, db, toasts, btnTexts } from './lib.mjs';
await start();
const DATE='2026-09-29';
const { page } = await open('client', `/book?staff=st_nuri_ani&service=sv_nuri_classic`, { device: 'desktop' });
await page.getByRole('button', { name: /вт, 29 сентября/ }).click(); await page.waitForTimeout(1000);
console.log('client 29 before', (await text(page)).match(/\d\d:\d\d/g));
let d = await db(page);
const day = d.core.bookings.filter(b=>b.staffId==='st_nuri_ani' && b.start.startsWith(DATE) && !b.deletedAt).sort((a,b)=>a.start.localeCompare(b.start));
console.log('ani 29', JSON.stringify(day.map(b=>[b.id,b.start,b.durationMin,b.status])));
const target = day.find(b=>!['cancelled_by_client','cancelled_by_master','no_show'].includes(b.status));
await as(page, 'owner', `/biz/journal?date=${DATE}`);
const hm = target.start.slice(11,16);
await page.locator('[data-testid="booking-block"]', { hasText: hm }).first().click(); await page.waitForTimeout(1500);
console.log('WIN', (await page.locator('[role=dialog]').last().innerText()).replace(/\n+/g,' | ').slice(0,160));
await page.locator('[role=dialog]').last().getByRole('button', { name: 'Удалить' }).first().click(); await page.waitForTimeout(800);
const c = page.locator('[role=alertdialog]'); if (await c.count()) { console.log('CONFIRM', (await c.innerText()).replace(/\n+/g,' | ')); await c.getByRole('button').last().click(); }
await page.waitForTimeout(1000); console.log('toasts', await toasts(page));
for (let i=0;i<12;i++){ d = await db(page); const b = d.core.bookings.find(x=>x.id===target.id); if (b.deletedAt) { console.log('deletedAt after', i, 's', b.deletedAt); break;} await page.waitForTimeout(1000); }
await as(page, 'client', `/book?staff=st_nuri_ani&service=sv_nuri_classic`);
await page.getByRole('button', { name: /вт, 29 сентября/ }).click(); await page.waitForTimeout(1000);
console.log('client 29 after delete', (await text(page)).match(/\d\d:\d\d/g));
await stop();
