import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('client', `/`, { device: 'phone' });
const badge = async () => (await page.locator('a[href="/notifications"]').first().innerText().catch(()=>'')).trim();
let d = await db(page); console.log('unread in db', d.areas.client.notifications.filter(n=>n.appUserId==='au_01' && !n.readAt).length, 'home badge', JSON.stringify(await badge()));
await as(page, 'client', '/notifications'); await page.waitForTimeout(1500);
const t = await text(page); console.log('notif header', t.slice(0,120).replace(/\n/g,' | '), '| mark all btn', await page.getByRole('button', { name: /Прочитать все|Отметить/ }).count());
d = await db(page); console.log('unread after visiting feed', d.areas.client.notifications.filter(n=>n.appUserId==='au_01' && !n.readAt).length);
await as(page, 'client', '/'); console.log('home badge after', JSON.stringify(await badge()));
// name change
await as(page, 'client', '/profile');
await page.getByRole('button', { name: 'Изменить имя' }).click(); await page.waitForTimeout(600);
const dlg = page.locator('[role=dialog]').last(); await dlg.locator('input').first().fill('Ани Проверкина'); await dlg.getByRole('button', { name: /Сохранить/ }).click(); await page.waitForTimeout(1500);
console.log('toasts', await toasts(page)); await reload(page); console.log('profile name after reload', (await text(page)).includes('Ани Проверкина'));
d = await db(page); console.log('appUser', JSON.stringify(d.core.appUsers.find(u=>u.id==='au_01')), 'clients w/ app au_01', JSON.stringify(d.core.clients.filter(c=>c.appUserId==='au_01').map(c=>[c.businessId,c.name])));
// logout
await page.getByRole('button', { name: 'Выйти' }).click(); await page.waitForTimeout(800);
const cd = page.locator('[role=alertdialog]'); if (await cd.count()) { await cd.getByRole('button').last().click(); } await page.waitForTimeout(1500);
console.log('after logout url', page.url(), (await text(page)).slice(0,150).replace(/\n/g,' | '));
await as(page, 'guest', '/bookings/bk_0081'); console.log('guest on bk_0081', (await text(page)).slice(0,120).replace(/\n/g,' | '));
await as(page, 'guest', '/bookings/bk_0081/reschedule'); console.log('guest reschedule', (await text(page)).slice(0,120).replace(/\n/g,' | '));
await stop();
