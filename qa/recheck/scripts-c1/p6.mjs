import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('platform', '/platform/businesses', { device: 'desktop' });
await page.getByText('Nuri Nail Studio').first().click(); await page.waitForTimeout(1200);
const tabs = await page.getByRole('tab').allInnerTexts(); log('tabs', tabs);
await page.getByRole('tab', { name: /Копии и выгрузка/ }).click().catch(()=>{}); await page.waitForTimeout(800);
log('tab text', (await page.locator('[role=dialog]').last().innerText()).slice(0,500).replace(/\n/g,' | ')); await page.getByRole('button', { name: /клиент/i }).first().click(); await page.waitForTimeout(1500);
const t1 = await toast(page);
await page.getByRole('button', { name: /записи/i }).first().click(); await page.waitForTimeout(1500);
const t2 = await toast(page);
const d = await db(page);
log('export toasts', t1, t2, 'expected clients', d.core.clients.filter(c=>c.businessId==='biz_nuri').length, 'bookings', d.core.bookings.filter(b=>b.businessId==='biz_nuri' && !b.deletedAt).length, 'bookings incl deleted', d.core.bookings.filter(b=>b.businessId==='biz_nuri').length);
// demand award
await go(page, '/platform/demand');
log('--- demand\n' + (await text(page)).slice(0, 1500));
const aw = page.getByRole('button', { name: /Наградить/ });
log('award btns', await aw.count());
if (await aw.count()) { await aw.first().click(); await page.waitForTimeout(1500); log('award toast', await toast(page)); await page.reload(); await settle(page); log('after reload awarded', ((await text(page)).match(/Награжд[^\n]*/g)||[]).length, 'award btns now', await page.getByRole('button', { name: /Наградить/ }).count()); }
log('ERR', page.errors.slice(0,3));
await stop();
