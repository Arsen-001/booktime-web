import { start, stop, open, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('platform', '/platform/promocodes', { device: 'desktop' });
await page.getByRole('button', { name: 'Выдать бесплатный месяц' }).click(); await page.waitForTimeout(800);
const dlg = page.locator('[role=dialog]').last(); console.log('DLG', (await dlg.innerText()).replace(/\n+/g,' | ').slice(0,500));
const combos = dlg.getByRole('combobox'); console.log('combos', await combos.allInnerTexts());
if (await combos.count()) { await combos.first().click(); await page.waitForTimeout(300); const o = await page.getByRole('option').allInnerTexts(); console.log('opts', o.slice(0,6)); await page.getByRole('option', { name: /Kaytsak/ }).first().click().catch(()=>page.getByRole('option').nth(1).click()); }
await page.waitForTimeout(300);
await dlg.getByRole('button', { name: /Выдать|Сохранить|Создать/ }).last().click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
await reload(page); const t = await text(page); console.log('rows', t.slice(t.indexOf('Код'), t.indexOf('Код')+700).replace(/\n/g,' | '));
const d = await db(page); console.log('biz kaytsak meta', JSON.stringify(d.areas.platform.bizMeta?.biz_kaytsak ?? {}).slice(0,300));
await as(page, 'platform', '/platform/businesses'); const bt = await text(page); const i = bt.indexOf('Kaytsak'); console.log('businesses row', bt.slice(i, i+160).replace(/\n/g,' | '));
await stop();
