import { start, stop, open, go, as, text, shot, db } from './lib.mjs';
await start();
const { page } = await open('client', '/book?staff=st_nuri_ani&service=sv_nuri_classic', { device: 'phone' });
const days = await page.locator('main button').filter({ hasText: /^(Сегодня|Завтра|[а-я]{2}, \d+ [а-я]+)$/ }).allInnerTexts(); console.log('client days:', days.join(' / '));
for (const dname of ['вс, 27 сентября', 'сб, 26 сентября', 'ср, 30 сентября']) {
  const b = page.getByRole('button', { name: dname }); if (!(await b.count())) { console.log(dname, 'NOT OFFERED'); continue; }
  await b.click(); await page.waitForTimeout(800); console.log(dname, 'slots:', (await page.locator('main button').filter({ hasText: /^\d{1,2}:\d{2}$/ }).allInnerTexts()).join(' '));
}
await shot(page, 'S3-client-days');
const d = await db(page);
const s = d.core.schedules.filter(x => x.staffId === 'st_nuri_ani'); console.log('ani schedules', JSON.stringify(s).slice(0, 700));
console.log('ani 27/30 bookings', d.core.bookings.filter(b => b.staffId === 'st_nuri_ani' && /2026-09-(26|27|30)/.test(b.start)).map(b => b.start + ' ' + b.status));
console.log('marks ani 26-30', JSON.stringify(d.core.calendarMarks.filter(m => m.staffId === 'st_nuri_ani' && /2026-09-(26|27|28|29|30)/.test(m.date))));
await as(page, 'owner', '/biz/schedule'); await page.waitForTimeout(500);
const rows = await page.locator('main tr').filter({ hasText: 'Ани Саргсян' }).allInnerTexts(); console.log('grid row:', rows.map(r => r.replace(/\s+/g, ' ')).join(' || '));
await shot(page, 'S3-owner-grid');
await stop();
