import { start, stop, open, as, reload, text, shot, db, toasts, btnTexts } from './lib.mjs';
await start();
const { page } = await open('master', '/biz/schedule/calendar', { device: 'desktop' });
console.log('browser tz', await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone + ' ' + new Date().toString()));
let d = await db(page); const n0 = d.core.bookings.length;
await page.locator('[data-f="F-00-060"]').first().click(); await page.waitForTimeout(600);
const dlg = page.locator('[role=dialog]').last();
console.log('DLG', (await dlg.innerText()).replace(/\n+/g,' | ').slice(0,900));
await dlg.getByText('Лусине Овсепян').first().click(); await page.waitForTimeout(300);
console.log('DLG2', (await dlg.innerText()).replace(/\n+/g,' | ').slice(0,900));
await dlg.getByRole('button', { name: 'Сохранить' }).click(); await page.waitForTimeout(2000);
console.log('toasts', await toasts(page));
d = await db(page); const nb = d.core.bookings.slice(n0);
console.log('new bookings', JSON.stringify(nb.map(b=>({id:b.id,start:b.start,dur:b.durationMin,staff:b.staffId,client:b.clientId,svc:b.services?.map(s=>s.serviceId),st:b.status}))));
const others = nb[0] && d.core.bookings.filter(b=>b.id!==nb[0].id && b.staffId===nb[0].staffId && !b.deletedAt && !['cancelled_by_client','cancelled_by_master','no_show'].includes(b.status) && b.start.slice(0,10)===nb[0].start.slice(0,10)).map(b=>[b.start,b.durationMin]);
console.log('same day others', JSON.stringify(others));
if (nb[0]) { await as(page, 'owner', '/biz/journal'); const t = await text(page); console.log('journal has Лусине?', /Лусине Овсепян/.test(t)); await shot(page,'s6-journal'); }
// master: only self; try others via URL
await as(page, 'master', '/biz/schedule');
const t2 = await text(page); console.log('master sees', ['Нарине Акопян','Мариам Петросян','Сона Григорян','Ани Саргсян'].map(n=>n+':'+t2.includes(n)).join(' '));
await as(page, 'master', '/biz/schedule/calendar?staff=st_nuri_mariam');
const t3 = await text(page); console.log('master calendar?staff=mariam:', t3.slice(0,300).replace(/\n/g,' | '));
await shot(page,'s6-master-other');
await stop();
