import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/online/settings`, { device: 'desktop' });
const sec = page.locator('section, [data-f]').filter({ hasText: 'Встроенные поля' }).first();
const sw = await page.getByRole('switch').evaluateAll(els=>els.map(e=>{ const lab = e.closest('label, div')?.innerText?.trim().split('\n')[0]; return lab+':'+e.getAttribute('aria-checked')+':'+(e.disabled||e.getAttribute('aria-disabled')); })); console.log(sw);
const byLabel = (l) => page.locator('label, div').filter({ hasText: new RegExp('^'+l+'$') }).first();
// switches in order: pause, show comment, comment req, show email, email req, surname, surname req, patronymic, patr req
const S = page.getByRole('switch');
await S.nth(4).click(); await page.waitForTimeout(700); // email required
await S.nth(5).click(); await page.waitForTimeout(700); // surname
await S.nth(6).click(); await page.waitForTimeout(700); // surname required
console.log('after', await page.getByRole('switch').evaluateAll(els=>els.map(e=>e.getAttribute('aria-checked')+'/'+(e.disabled))));
console.log('toasts', await toasts(page));
await page.getByPlaceholder('Название поля').fill('Номер машины'); 
const req = page.locator('label').filter({ hasText: 'Обязательное' }).last(); await req.click().catch(()=>{});
await page.getByRole('button', { name: 'Добавить поле' }).click(); await page.waitForTimeout(1200); console.log('toasts', await toasts(page));
await reload(page); const t = await text(page); console.log('custom fields after reload', t.slice(t.indexOf('Свои поля'), t.indexOf('Свои поля')+120).replace(/\n/g,' | '));
console.log('switches after reload', await page.getByRole('switch').evaluateAll(els=>els.map(e=>e.getAttribute('aria-checked'))));
let d = await db(page); console.log('clientFields', JSON.stringify(d.areas.online.clientFields).slice(0,500));
await stop();
