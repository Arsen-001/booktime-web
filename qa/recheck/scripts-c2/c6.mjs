import { start, stop, open, as, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/clients`, { device: 'desktop' });
let d = await db(page);
const cls = d.core.clients.filter(c=>c.businessId==='biz_nuri');
const withApp = cls.filter(c=>c.appUserId); console.log('clients', cls.length, 'with appUserId', withApp.length, JSON.stringify(withApp.map(c=>c.name)));
const appPhones = new Set(d.core.appUsers.map(u=>u.phone)); console.log('clients whose phone is an app user', cls.filter(c=>appPhones.has(c.phone)).length);
// no-show clients
const ns = new Set(d.core.bookings.filter(b=>b.businessId==='biz_nuri' && b.status==='no_show' && !b.deletedAt).map(b=>b.clientId)); console.log('clients with no_show (any time)', ns.size);
const t0 = await text(page); console.log('segments', t0.slice(0, 600).replace(/\n/g,' | '));
await page.getByText('Неявщики', { exact: false }).first().click(); await page.waitForTimeout(1500);
const t1 = await text(page); console.log('after Неявщики', t1.match(/\d+–\d+ из \d+/)?.[0], t1.match(/Фильтры[^\n]*/)?.[0]);
await shot(page, 'c6-noshow');
// open actions menu
await as(page, 'owner', `/biz/clients`);
await page.getByRole('button', { name: /Действия/ }).first().click(); await page.waitForTimeout(600);
console.log('MENU', (await page.locator('[role=menu]').last().innerText().catch(()=>'')).replace(/\n/g,' | '));
await page.getByRole('menuitem', { name: /PUSH в мобильные/ }).click().catch(e=>console.log('no menuitem')); await page.waitForTimeout(800);
console.log('PUSH MODAL', (await page.locator('[role=dialog]').last().innerText()).replace(/\n+/g,' | ').slice(0,300));
await stop();
