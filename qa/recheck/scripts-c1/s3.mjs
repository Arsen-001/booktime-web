import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('owner', '/biz/schedule', { device: 'desktop' });
const names = async () => (await page.locator('tbody tr').allInnerTexts()).map(r => r.split('\n').filter(Boolean)[1]);
log('initial', await names());
// Нет графика
const sel = page.locator('select').filter({ has: page.locator('option', { hasText: 'Нет графика' }) });
await sel.selectOption({ label: 'Нет графика' }); await page.waitForTimeout(1200);
log('Нет графика ->', await names(), (await text(page)).match(/Сотрудники \(\d+\)/)?.[0]);
await sel.selectOption({ label: 'Все' }); await page.waitForTimeout(1000);
// positions
await page.getByRole('button', { name: /Должность/ }).click(); await page.waitForTimeout(700);
const pop = page.locator('[role=dialog], [role=menu], [data-radix-popper-content-wrapper]').last();
log('positions list', (await pop.innerText()).replace(/\n/g,' | '));
await pop.getByText('Мастер маникюра', { exact: true }).click(); await page.waitForTimeout(800);
log('after Мастер маникюра ->', await names());
await pop.getByText('Мастер педикюра', { exact: true }).click().catch(e=>log('click2 err', e.message.slice(0,80))); await page.waitForTimeout(800);
log('after + Мастер педикюра ->', await names());
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
log('after close ->', await names());
const d = await db(page);
log('staff positions', JSON.stringify(d.core.staff.filter(s=>s.businessId==='biz_nuri').map(s=>[s.name, s.position ?? s.positionId ?? s.title, s.status])));
log('ERR', page.errors.slice(0,3));
await stop();
