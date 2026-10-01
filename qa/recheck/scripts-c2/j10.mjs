import { start, stop, open, as, text, shot, db, toasts } from './lib.mjs';
await start();
const DATE='2026-10-13';
const { page } = await open('owner', `/biz/journal?new=1&staff=st_nuri_ani&start=16:00&date=${DATE}`, { device: 'desktop' });
let d = await db(page); const ids0 = new Set(d.core.bookings.map(b=>b.id));
const win = page.locator('[role=dialog]').last();
const btn = win.getByRole('button', { name: 'Сохранить пустую запись' }); console.log('empty btn', await btn.count());
await btn.click(); await page.waitForTimeout(800);
const c = page.locator('[role=alertdialog], [role=dialog]').last(); console.log('CONFIRM', (await c.innerText()).replace(/\n+/g,' | ').slice(0,200));
await page.getByRole('button', { name: 'Всё равно сохранить' }).click(); await page.waitForTimeout(3000); console.log('toasts', await toasts(page));
d = await db(page); console.log('new', JSON.stringify(d.core.bookings.filter(b=>!ids0.has(b.id)).map(b=>({s:b.start,d:b.durationMin,c:b.clientId,svc:b.services.length,st:b.status}))));
// master views
await as(page, 'master', `/biz/journal?date=${DATE}`);
const t = await text(page); console.log('master journal cols', ['Ани Саргсян','Мариам Петросян','Сона Григорян','Гаяне Оганесян'].map(n=>n+':'+t.includes(n)).join(' '));
await as(page, 'master', '/biz/records');
const t2 = await text(page); console.log('master records', ['Ани Саргсян','Мариам Петросян','Сона Григорян','Гаяне Оганесян'].map(n=>n+':'+(t2.split(n).length-1)).join(' '));
await shot(page, 'j10-master-records');
await stop();
