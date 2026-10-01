import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
const { page } = await open('owner', '/biz/journal', { device: 'desktop' });
// load dots
const titles = await page.locator('[title^="Загрузка"], [aria-label*="Загрузка"]').evaluateAll(els => els.map(e => (e.closest('button')?.innerText||'').trim() + ':' + (e.getAttribute('title')||e.getAttribute('aria-label'))));
log('load titles', titles.slice(0, 40));
const d = await db(page);
const staffIds = d.core.staff.filter(s=>s.businessId==='biz_nuri' && s.status==='active').map(s=>s.id);
log('staff', staffIds);
// week view
const sel = page.locator('select').filter({ has: page.locator('option', { hasText: 'Неделя' }) });
log('selects', await sel.count());
await sel.first().selectOption({ label: 'Неделя' }); await page.waitForTimeout(2000);
const wt = await text(page);
log('--- week\n' + wt.slice(wt.indexOf('Неделя'), wt.indexOf('Неделя') + 800));
const staffSel = page.locator('select').filter({ has: page.locator('option', { hasText: 'Ани Саргсян' }) });
log('staffSel', await staffSel.count());
if (await staffSel.count()) { await staffSel.first().selectOption({ label: 'Ани Саргсян' }); await page.waitForTimeout(2000); }
const wt2 = await text(page);
log('--- week Ani\n' + wt2.slice(wt2.indexOf('Неделя'), wt2.indexOf('Неделя') + 1200));
await shot(page, 'j6-week-ani');
log('ERR', page.errors.slice(0,3));
await stop();
