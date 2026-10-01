import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('master', '/biz/clients', { device: 'desktop' });
log('add disabled', await page.getByRole('button', { name: 'Добавить клиента' }).first().isDisabled());
log('first rows', (await page.locator('tbody tr').allInnerTexts()).slice(0,3).map(r=>r.replace(/\s+/g,' ')));
await page.getByRole('button', { name: /Операции с Excel/ }).click(); await page.waitForTimeout(600);
const ex = page.getByRole('menuitem', { name: /Выгрузить в Excel/ });
log('export item', await ex.count(), await ex.first().getAttribute('aria-disabled').catch(()=>null));
if (await ex.count()) { await ex.first().click(); await page.waitForTimeout(1500); log('export toast', await toast(page)); }
await go(page, '/biz/clients/cl_001');
log('card for master', (await text(page)).slice(0, 300), 'edit btn', await page.getByRole('button', { name: 'Изменить' }).count());
await shot(page, 'k6-master-card');
log('ERR', page.errors.slice(0,3));
await stop();
