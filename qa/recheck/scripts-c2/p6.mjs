import { start, stop, open, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('platform', '/platform/moderation', { device: 'desktop' });
const row = page.locator('tr, li, div').filter({ hasText: 'Описание' }).filter({ hasText: 'Лусине Погосян' }).filter({ has: page.getByRole('button', { name: /Отклонить/ }) }).last();
await row.getByRole('button', { name: /Отклонить/ }).click(); await page.waitForTimeout(800);
const menu = page.locator('[role=menu], [role=listbox], [role=dialog]').last(); console.log('MENU', (await menu.innerText().catch(()=>'none')).replace(/\n+/g,' | ').slice(0,400));
const items = page.getByRole('menuitem'); console.log('menuitems', await items.allInnerTexts());
if (await items.count()) { await items.first().click(); await page.waitForTimeout(1200); }
console.log('after pick', (await page.locator('[role=dialog]').last().innerText().catch(()=>'no dialog')).replace(/\n+/g,' | ').slice(0,300), await toasts(page));
const c2 = page.locator('[role=dialog]').last().getByRole('button', { name: /Отклонить|Подтвердить/ }); if (await c2.count()) { await c2.last().click(); await page.waitForTimeout(1200); console.log('toasts2', await toasts(page)); }
let d = await db(page); console.log('mod_6', JSON.stringify(d.areas.platform.moderationItems.find(m=>m.id==='mod_6')).slice(0,400));
// does text appear to clients? (pending/rejected text must not be shown)
await as(page, 'client', '/places/biz_lusine'); const t = await text(page); console.log('client sees rejected text', t.includes('одноразовые пилки'));
await stop();
