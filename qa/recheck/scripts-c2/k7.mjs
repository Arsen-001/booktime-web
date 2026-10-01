import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('client', `/diary`, { device: 'phone' });
await page.getByRole('button', { name: 'Добавить расход' }).click(); await page.waitForTimeout(800);
const dlg = page.locator('[role=dialog]').last(); console.log('DLG', (await dlg.innerText()).replace(/\n+/g,' | ').slice(0,300));
const inputs = await dlg.locator('input, textarea').evaluateAll(els=>els.map(e=>`${e.type}|${e.placeholder}|${e.getAttribute('inputmode')}`)); console.log(inputs);
const txt = dlg.locator('input[type=text], input:not([type])').first(); await txt.fill('Педикюр у подруги');
const money = dlg.locator('input[inputmode=numeric], input[inputmode=decimal]').first(); await money.fill('7777');
await dlg.getByRole('button', { name: /Сохранить|Добавить/ }).last().click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
await reload(page); const t = await text(page); console.log('after reload', t.match(/Всего потрачено\n([^\n]+)/)?.[1], t.includes('Педикюр у подруги'));
// time format
await as(page, 'client', '/profile'); await page.getByRole('radio', { name: '12 часов (AM/PM)' }).click(); await page.waitForTimeout(1200);
await reload(page); console.log('12h checked after reload', await page.getByRole('radio', { name: '12 часов (AM/PM)' }).getAttribute('aria-checked'));
for (const r of ['/bookings', '/bookings/bk_0081', '/notifications', '/', '/masters/st_nuri_ani', '/book?staff=st_nuri_ani&service=sv_nuri_classic']) { await as(page, 'client', r); const x = await text(page); console.log(r, '24h-times:', (x.match(/\b(1[3-9]|2[0-3]):\d\d\b/g)||[]).slice(0,4), 'AM/PM:', (x.match(/\d{1,2}:\d\d\s?(AM|PM)/g)||[]).slice(0,3)); }
await stop();
