import { start, stop, open, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/notifications/inbox`, { device: 'desktop' });
const cntRows = async () => (await text(page)).match(/\n(Новая запись|Новая онлайн-запись|Перенос[^\n]*|Отмена[^\n]*)\n/g)?.length ?? 0;
await page.getByRole('radio', { name: 'Новые' }).click().catch(()=>page.getByText('Новые').first().click()); await page.waitForTimeout(800);
console.log('new rows', await cntRows(), (await text(page)).slice(0,200).replace(/\n/g,' | '));
await page.getByRole('button', { name: 'Прочитать все' }).click(); await page.waitForTimeout(1500);
console.log('after read all (Новые)', await cntRows(), (await text(page)).slice(0,250).replace(/\n/g,' | '));
await reload(page); await page.getByRole('radio', { name: 'Новые' }).click().catch(()=>page.getByText('Новые').first().click()); await page.waitForTimeout(800);
console.log('after reload Новые', await cntRows());
// click first item opens booking?
await page.getByRole('radio', { name: 'Все' }).click().catch(()=>page.getByText('Все').first().click()); await page.waitForTimeout(800);
const first = page.getByText('Новая запись').first(); await first.click(); await page.waitForTimeout(2500);
console.log('after click url', page.url(), '| dialog', (await page.locator('[role=dialog]').last().innerText().catch(()=>'none')).slice(0,120).replace(/\n/g,' | '));
await shot(page, 'n5-inbox-click');
// log filters
await as(page, 'owner', '/biz/notifications/log');
let t = await text(page); console.log('LOG', t.slice(0,700).replace(/\n/g,' | '));
const combos = page.getByRole('combobox'); console.log('log combos', await combos.allInnerTexts());
await stop();
