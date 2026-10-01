import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/notifications');
const T = async (n=1200) => (await text(page)).slice(0, n);
const links = await page.locator('main a[href^="/biz/notifications/types/"]').evaluateAll(a => a.map(x => x.getAttribute('href') + ' ' + x.innerText.replace(/\s+/g, ' ').slice(0, 60)));
console.log(links.filter(l => /журнал|Создани/i.test(l)));
const href = links.find(l => /Создание записи через журнал/i.test(l))?.split(' ')[0] || '/biz/notifications/types/1';
await go(page, '/biz/notifications/types/1/templates'); console.log((await T(300)).replace(/\n/g,' | '));
const lang = page.getByRole('combobox', { name: 'Язык уведомлений клиентам' }); console.log('lang combo', await lang.count(), await lang.innerText().catch(()=>''));
await pick(page, lang, 'English'); await page.waitForTimeout(800);
const sv = page.getByRole('button', { name: 'Сохранить' }); if (await sv.count() && await sv.last().isEnabled()) { await sv.last().click(); await page.waitForTimeout(1200); }
console.log('toasts', await toasts(page));
await reload(page); console.log('lang after reload', await page.getByRole('combobox', { name: 'Язык уведомлений клиентам' }).innerText());
// is it per location? open another type
await go(page, '/biz/notifications/types/9/templates'); console.log('type 9 lang:', await page.getByRole('combobox', { name: 'Язык уведомлений клиентам' }).innerText().catch(()=>'n/a'));
// create booking for cl_001 (has app?)
const d = await db(page); const c = d.core.clients.find(x => x.id === 'cl_001'); console.log('cl_001', c.phone, 'appUser?', d.core.appUsers.some(u => u.phone === c.phone));
await go(page, '/biz/journal?new=1&client=cl_001&staff=st_nuri_ani&date=2026-09-30&start=12:00');
const dlg = page.locator('[role=dialog]').last();
await dlg.getByText('Маникюр классический').first().click(); await page.waitForTimeout(400);
await dlg.getByRole('button', { name: /^Записать$/ }).click(); await page.waitForTimeout(2000);
const top = page.locator('[role=dialog]').last(); const yes = top.getByRole('button', { name: 'Да', exact: true }); if (await yes.count()) { await yes.click(); await page.waitForTimeout(1500); }
console.log('toasts', await toasts(page));
await go(page, '/biz/notifications/log'); const rows = await page.locator('main tbody tr').allInnerTexts(); console.log('log top:', rows.slice(0, 4).map(r => r.replace(/\s+/g, ' ').slice(0, 200)));
console.log('UI title still ru:', (await T(60)).split('\n')[0]);
await stop();
