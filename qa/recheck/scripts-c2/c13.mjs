import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/clients`, { device: 'desktop' });
let d = await db(page); const n0 = d.core.clients.length;
await page.getByRole('button', { name: 'Добавить клиента' }).click(); await page.waitForTimeout(600);
await page.locator('input[placeholder="Как зовут клиента"]').fill('Дубль Сидовой');
await page.locator('input[placeholder="Номер телефона"]').first().fill('00160001');
await page.getByRole('button', { name: 'Добавить', exact: true }).click(); await page.waitForTimeout(2500);
console.log('toasts', await toasts(page), 'url', page.url());
d = await db(page); console.log('clients +', d.core.clients.length - n0, 'with phone', d.core.clients.filter(c=>c.phone==='+37400160001').map(c=>c.name));
await shot(page, 'c13-dup-seeded');
// rename cl_002
await as(page, 'owner', `/biz/clients/cl_002`);
await page.getByRole('button', { name: 'Изменить' }).first().click(); await page.waitForTimeout(600);
await page.locator('input[placeholder="Как зовут клиента"]').fill('Лусине Переименована');
await page.getByRole('button', { name: 'Сохранить' }).last().click(); await page.waitForTimeout(800);
const cd = page.locator('[role=alertdialog],[role=dialog]').last(); console.log('CONFIRM', (await cd.innerText()).replace(/\n+/g,' | ').slice(0,200));
await cd.getByRole('button', { name: /Да|Сохранить|Подтвердить/ }).last().click(); await page.waitForTimeout(2000);
console.log('toasts', await toasts(page));
await reload(page); console.log('after reload name', (await text(page)).split('\n')[0]);
// same client name on journal booking
const b = (await db(page)).core.bookings.find(x=>x.clientId==='cl_002' && x.start>'2026-09-25'); console.log('future booking', b?.start);
if (b) { await as(page, 'owner', `/biz/journal?date=${b.start.slice(0,10)}`); console.log('journal shows new name', (await text(page)).includes('Лусине П.') || (await page.content()).includes('Переименована')); }
// delete word gate
await as(page, 'owner', `/biz/clients`);
await page.getByRole('button', { name: /Действия/ }).first().click(); await page.waitForTimeout(600);
await page.getByText('Удалить из базы').click(); await page.waitForTimeout(800);
const dd = page.locator('[role=dialog]').last(); const delBtn = dd.getByRole('button', { name: /^Удалить/ }).last();
console.log('delete enabled w/o word', await delBtn.isEnabled(), await delBtn.getAttribute('aria-disabled'));
await delBtn.click({ force: true }).catch(()=>{}); await page.waitForTimeout(1500);
d = await db(page); console.log('clients after forced click', d.core.clients.filter(c=>c.businessId==='biz_nuri').length);
await dd.locator('input').fill('удалить'); await page.waitForTimeout(300); console.log('lowercase enabled', await delBtn.isEnabled());
await stop();
