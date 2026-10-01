import { start, stop, open, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/notifications/channels/sms`, { device: 'desktop' });
await page.locator('input[placeholder="AGG-XXXX-XXXX"]').fill('AGG-TEST-1234'); await page.getByRole('button', { name: 'Подключить' }).click(); await page.waitForTimeout(1500);
await as(page, 'owner', '/biz/notifications/types/1');
let t = await text(page); const i = t.indexOf('SMS'); console.log('SMS row', t.slice(i, i+120).replace(/\n/g,' | '));
const combos = page.getByRole('combobox'); console.log('combos', await combos.count(), await combos.allInnerTexts());
// set SMS (3rd combo) to fallback option
await combos.nth(2).click(); await page.waitForTimeout(400); const opts = await page.getByRole('option').allInnerTexts(); console.log('sms opts', opts); 
await page.getByRole('option').filter({ hasText: /не доставлен|не доставил/ }).first().click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
t = await text(page); const j = t.indexOf('Что уйдёт клиенту'); console.log('PREVIEW', t.slice(j, j+200).replace(/\n/g,' | '));
// set push to Не отправлять for type 1 only
await pick(page, combos.nth(0), 'Не отправлять'); await page.waitForTimeout(1200);
t = await text(page); console.log('PREVIEW2', t.slice(t.indexOf('Что уйдёт клиенту'), t.indexOf('Что уйдёт клиенту')+200).replace(/\n/g,' | '));
await reload(page); console.log('after reload combos', await page.getByRole('combobox').allInnerTexts());
await as(page, 'owner', '/biz/notifications/types/7'); console.log('type 7 combos', await page.getByRole('combobox').allInnerTexts());
await as(page, 'owner', '/biz/notifications'); t = await text(page); const k = t.indexOf('Напоминание о визите'); console.log('list row type1', t.slice(k, k+60).replace(/\n/g,' | '));
await stop();
