import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('client', `/bookings/bk_0080`, { device: 'phone' });
await page.getByRole('button', { name: 'Оценить мастера' }).click(); await page.waitForTimeout(2000);
let d = await db(page); console.log('ratings', JSON.stringify(d.areas.client.starRatings.map(r=>[r.staffId,r.bookingId])));
await as(page, 'client', '/masters/st_nuri_ani'); const t = await text(page); console.log(t.slice(0,400).replace(/\n/g,' | '));
console.log('badge F-00-116', await page.locator('[data-f="F-00-116"]').count());
await as(page, 'client', '/masters/st_atam_seda'); const t2 = await text(page); console.log('seda', t2.slice(0,300).replace(/\n/g,' | '), await page.locator('[data-f="F-00-116"]').count());
await stop();
