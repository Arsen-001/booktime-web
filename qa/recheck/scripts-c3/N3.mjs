import { start, stop, open, go, as, reload, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/notifications/types/1/templates');
const T = async (n=1200) => (await text(page)).slice(0, n);
const t = await T(5000); const i = t.indexOf('Формат'); console.log('format block:', t.slice(i, i + 200).replace(/\n/g, ' | '));
const combos = await page.getByRole('combobox').evaluateAll(a => a.map(x => (x.getAttribute('aria-label') || '') + '=' + x.innerText)); console.log('combos', combos);
const fmt = page.getByRole('combobox', { name: /Формат/ }); 
if (await fmt.count()) { await fmt.first().click(); await page.waitForTimeout(400); const opts = await page.getByRole('option').allInnerTexts(); console.log('opts', opts); const o = opts.find(x => /12/.test(x)); await page.getByRole('option', { name: o, exact: true }).last().click(); await page.waitForTimeout(500); }
const sv = page.getByRole('button', { name: 'Сохранить' }); if (await sv.count() && await sv.last().isEnabled()) { await sv.last().click(); await page.waitForTimeout(1200); }
console.log('toasts', await toasts(page));
await go(page, '/biz/journal?new=1&client=cl_001&staff=st_nuri_ani&date=2026-09-30&start=15:00');
const dlg = page.locator('[role=dialog]').last();
await dlg.getByText('Маникюр классический').first().click(); await page.waitForTimeout(400);
await dlg.getByRole('button', { name: /^Записать$/ }).click(); await page.waitForTimeout(2000);
const top = page.locator('[role=dialog]').last(); const yes = top.getByRole('button', { name: 'Да', exact: true }); if (await yes.count()) { await yes.click(); await page.waitForTimeout(1500); }
await go(page, '/biz/notifications/log'); const rows = await page.locator('main tbody tr').allInnerTexts(); console.log('log:', rows.slice(0, 3).map(r => r.replace(/\s+/g, ' ').slice(0, 200)));
await as(page, 'master', '/biz/notifications'); console.log('master notif:', (await T(200)).replace(/\n/g, ' | '));
await as(page, 'master', '/biz/notifications/types/1/templates'); console.log('master type:', (await T(200)).replace(/\n/g, ' | '));
await stop();
