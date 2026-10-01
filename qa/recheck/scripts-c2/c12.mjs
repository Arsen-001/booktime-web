import { start, stop, open, as, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/clients`, { device: 'desktop' });
await page.getByRole('button', { name: /Действия/ }).first().click(); await page.waitForTimeout(600);
await page.getByText('Добавить в категорию').click(); await page.waitForTimeout(800);
const dlg = page.locator('[role=dialog]').last();
const inp = dlg.getByRole('combobox'); await inp.click(); await inp.fill('Проверка C4'); await page.waitForTimeout(500);
await page.getByRole('option').filter({hasText:'Проверка C4'}).first().click(); await page.waitForTimeout(400);
const t0 = Date.now();
await dlg.getByRole('button', { name: 'Добавить' }).last().click();
const count = async () => (await db(page)).core.clients.filter(c=>(c.tags||[]).includes('Проверка C4')).length;
let seen = [];
for (let i=0;i<90;i++){ await page.waitForTimeout(1000); const n = await count(); const ts = await toasts(page); const open = await dlg.isVisible().catch(()=>false); if (i%5===0 || ts.length) console.log(`${((Date.now()-t0)/1000).toFixed(0)}s tagged=${n} dialogOpen=${open} toasts=${JSON.stringify(ts)}`); if (n>=90) { console.log('done at', ((Date.now()-t0)/1000).toFixed(1),'s'); break; } }
await shot(page, 'c12-bulk-cat-progress');
await stop();
