import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('owner', '/biz/schedule', { device: 'desktop' });
const row = () => page.locator('tr', { hasText: 'Ани Саргсян' }).first();
// modify existing Monday: set nonworking
await row().locator('td, button', { hasText: 'пн, 21 сентября' }).last().click(); await page.waitForTimeout(1000);
const dlg = page.locator('[role=dialog]').last();
await dlg.locator('select').filter({ has: page.locator('option', { hasText: 'Нерабочий день' }) }).selectOption({ label: 'Нерабочий день' }); await page.waitForTimeout(500);
log('panel counts', (await dlg.innerText()).match(/Добавятся[^\n]*|Правка коснётся[^\n]*/g));
log('dialogs', (await page.locator('[role=dialog],[role=alertdialog]').allInnerTexts()).map(s=>s.slice(-300).replace(/\n/g,' | '))); await page.locator('[role=dialog]').last().getByRole('button', { name: 'Удалить', exact: true }).click(); await page.waitForTimeout(1500); log('warning shown', /уже есть \d+ запис/.test(await page.locator('[role=dialog]').last().innerText())); await page.locator('[role=dialog]').last().getByRole('button', { name: 'Удалить', exact: true }).click(); for (const ms of [300, 800, 1500, 3000]) { await page.waitForTimeout(ms === 300 ? 300 : ms - [300,800,1500,3000][[300,800,1500,3000].indexOf(ms)-1]); log('t+'+ms, await toast(page), (await page.locator('body').innerText()).match(/Добавлено дней[^\n]*|Отменить/g)); } await shot(page, 's4-toast'); await shot(page,'s4-after-delete'); const ub = page.getByRole('button', { name: 'Удалить' }).last(); log('udalit disabled?', await ub.isDisabled().catch(()=>'?'), 'count', await page.getByRole('button', { name: 'Удалить' }).count()); log('confirm?', (await page.locator('[role=alertdialog],[role=dialog]').allInnerTexts()).map(s=>s.slice(0,200).replace(/\n/g,' | ')));
log('toast', await toast(page));
log('row after save', (await row().innerText()).replace(/\n/g,' | ').slice(0,120), '...', (await row().innerText()).split('\n').slice(-1));
await page.getByRole('button', { name: 'Отменить' }).first().click(); await page.waitForTimeout(1500);
log('row after undo', (await row().innerText()).replace(/\n/g,' | ').slice(0,120), '...', (await row().innerText()).split('\n').slice(-1));
const d = await db(page);
log('db override 21', JSON.stringify(d.core.schedules.filter(s=>s.staffId==='st_nuri_ani').map(s=>[s.workplace, s.overrides['2026-09-21']])));
await page.reload(); await settle(page);
log('row after reload', (await row().innerText()).replace(/\n/g,' | ').slice(0,120));
// F-02-106 warning on a future date with bookings: next week Monday 28
await page.getByRole('button', { name: 'Следующий период' }).click(); await page.waitForTimeout(1200);
await row().locator('td, button', { hasText: 'пн, 28 сентября' }).last().click(); await page.waitForTimeout(1000);
await page.locator('[role=dialog]').last().locator('select').filter({ has: page.locator('option', { hasText: 'Нерабочий день' }) }).selectOption({ label: 'Нерабочий день' }); await page.waitForTimeout(800);
log('panel 28 text', (await page.locator('[role=dialog]').last().innerText()).split('Нерабочий день')[1]?.replace(/\n/g,' | '));
const d2 = await db(page); log('Ани bookings 28', JSON.stringify(d2.core.bookings.filter(b=>b.staffId==='st_nuri_ani' && b.start.startsWith('2026-09-28')).map(b=>[b.start,b.status])));
log('ERR', page.errors.slice(0,3));
await stop();
