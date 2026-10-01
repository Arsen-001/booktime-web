import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('owner', '/biz/schedule', { device: 'desktop' });
const row = page.locator('tr', { hasText: 'Ани Саргсян' }).first();
const cells = row.locator('td');
log('cells', await cells.count());
// Saturday cell = index of "сб, 26 сентября"
const sat = row.locator('td, button', { hasText: 'сб, 26 сентября' }).last();
log('sat cell', await sat.count(), (await sat.innerText()).replace(/\n/g,' '));
await sat.click(); await page.waitForTimeout(1200);
const dlg = page.locator('[role=dialog]').last();
log('--- panel\n' + (await dlg.innerText()).slice(0, 1200));
await shot(page, 's2-panel');
const saveBtn = dlg.getByRole('button', { name: 'Сохранить' });
await saveBtn.click(); await page.waitForTimeout(2000);
log('toast', await toast(page));
log('row after', (await row.innerText()).replace(/\n/g,' | '));
const d = await db(page);
const sc = d.core.schedules.filter(s=>s.staffId==='st_nuri_ani');
log('db overrides 26', JSON.stringify(sc.map(s=>[s.workplace, s.overrides['2026-09-26'], s.week[5]])));
await page.reload(); await settle(page);
log('row after reload', (await page.locator('tr', { hasText: 'Ани Саргсян' }).first().innerText()).replace(/\n/g,' | '));
// client side: book slots for Ани on Sat
await go(page, '/book?staff=st_nuri_ani&service=sv_nuri_classic&demo=client');
log('client days', (await text(page)).match(/Выберите время[\s\S]{0,300}/)?.[0].replace(/\n/g,' | '));
log('ERR', page.errors.slice(0,3));
await stop();
