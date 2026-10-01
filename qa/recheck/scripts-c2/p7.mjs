import { start, stop, open, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('platform', '/platform/visits', { device: 'desktop' });
const counters = async () => (await text(page)).match(/Все\n\d+\nДумают\n\d+\nПодключены\n\d+\nОтказались\n\d+/)?.[0]?.replace(/\n/g,' ');
console.log('before', await counters());
await page.getByRole('button', { name: 'Открыть' }).first().click(); await page.waitForTimeout(1000);
const dlg = page.locator('[role=dialog]').last(); console.log('DLG', (await dlg.innerText()).replace(/\n+/g,' | ').slice(0,600));
const combos = dlg.getByRole('combobox'); console.log('combos', await combos.allInnerTexts());
const radios = dlg.getByRole('radio'); console.log('radios', await radios.allInnerTexts());
const conn = dlg.getByText(/^Подключ/).first(); if (await conn.count()) await conn.click(); else if (await combos.count()) { await combos.first().click(); await page.waitForTimeout(300); console.log('opts', await page.getByRole('option').allInnerTexts()); await page.getByRole('option', { name: /Подключ/ }).first().click(); }
await page.waitForTimeout(300);
const save = dlg.getByRole('button', { name: /Сохранить/ }); if (await save.count()) await save.click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
console.log('after', await counters(), '| callbacks', (await text(page)).match(/Перезвонить: [^\n]+/)?.[0]);
await reload(page); console.log('after reload', await counters());
await stop();
