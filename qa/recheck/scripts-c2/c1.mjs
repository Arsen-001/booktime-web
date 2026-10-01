import { start, stop, open, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/clients/summary', { device: 'desktop' });
let d = await db(page);
const now = '2026-09-25';
const arr = d.core.bookings.filter(b=>b.businessId==='biz_nuri' && b.status==='arrived' && !b.deletedAt && b.start.slice(0,10)>='2026-09-01' && b.start.slice(0,10)<=now);
console.log('DB revenue', arr.reduce((s,b)=>s+b.total,0), 'clients', new Set(arr.map(b=>b.clientId).filter(Boolean)).size, 'visits', arr.length);
const t = await text(page); console.log('UI', t.match(/Выручка\n([^\n]+)/)?.[1], t.match(/Клиентов\n([^\n]+)/)?.[1], t.match(/Визитов\n([^\n]+)/)?.[1]);
// pending check: past, unmarked
const nowDT = '2026-09-25T06:30';
const pend = d.core.bookings.filter(b=>b.businessId==='biz_nuri' && !b.deletedAt && ['awaiting_confirmation','awaiting_prepayment','scheduled','client_confirmed'].includes(b.status) && b.start < nowDT);
console.log('pending past unmarked in DB', pend.length, JSON.stringify(pend.slice(0,3).map(b=>[b.start,b.status])));
// cl_001
const c1b = d.core.bookings.filter(b=>b.clientId==='cl_001' && !b.deletedAt);
console.log('cl_001 bookings', JSON.stringify(c1b.map(b=>[b.start,b.status,b.total])), 'profile', JSON.stringify(d.areas.clients.profiles['cl_001']).slice(0,300));
// Add past visit for cl_001
await as(page, 'owner', '/biz/clients/cl_001');
await page.getByRole('button', { name: 'Добавить визит' }).first().click(); await page.waitForTimeout(800);
const sh = page.locator('[role=dialog]').last();
console.log('SHEET', (await sh.innerText()).replace(/\n+/g,' | ').slice(0,700));
const combos = sh.getByRole('combobox'); console.log('combos', await combos.count(), await combos.allInnerTexts());
await shot(page, 'c1-addvisit');
await stop();
