import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('owner', '/biz/clients', { device: 'desktop' });
const rows = async () => (await page.locator('tbody tr').allInnerTexts()).map(r => r.replace(/\s+/g, ' ').trim());
const search = page.getByPlaceholder(/Поиск \(по имени/);
for (const q of ['00196143', '+37400196143', '196 143', '0 196']) { await search.fill(q); await page.getByRole('button', { name: 'Найти клиентов' }).click(); await page.waitForTimeout(1200); log('q', q, '->', (await rows())[0]?.slice(0,40)); }
await search.fill(''); await page.getByRole('button', { name: 'Найти клиентов' }).click(); await page.waitForTimeout(1200);
// F-04-010 open card
await page.locator('tbody tr').first().getByText('Ани Мелкумян').click(); await settle(page);
log('URL after click', page.url());
log('card text', (await text(page)).slice(0, 500));
await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
log('URL after Escape', page.url());
await go(page, '/biz/clients?client_id=cl_001'); 
log('?client_id url ->', page.url(), (await text(page)).slice(0, 200));
await go(page, '/biz/clients');
// add client
await page.getByRole('button', { name: 'Добавить клиента' }).first().click(); await page.waitForTimeout(1000);
const dlg = page.locator('[role=dialog]').last();
await dlg.getByPlaceholder('Как зовут клиента').fill('Перепроверка Клиент');
await dlg.locator('input[type=tel]').first().fill('77665544');
await dlg.getByRole('button', { name: 'Добавить', exact: true }).click(); await page.waitForTimeout(2500);
log('toast', await toast(page), 'URL', page.url());
await go(page, '/biz/clients');
await search.fill('Перепроверка'); await page.getByRole('button', { name: 'Найти клиентов' }).click(); await page.waitForTimeout(1200);
log('after reload new client row:', await rows());
log('total', (await text(page)).match(/\d+–\d+ из \d+/g));
// duplicate phone
await page.getByRole('button', { name: 'Добавить клиента' }).first().click(); await page.waitForTimeout(1000);
const dlg2 = page.locator('[role=dialog]').last();
await dlg2.getByPlaceholder('Как зовут клиента').fill('Дубль');
await dlg2.locator('input[type=tel]').first().fill('77665544');
await dlg2.getByRole('button', { name: 'Добавить', exact: true }).click(); await page.waitForTimeout(2000);
log('dup ->', await toast(page), (await dlg2.innerText().catch(()=>'closed')).match(/уже есть[^\n]*/)?.[0]);
await page.keyboard.press('Escape');
log('ERR', page.errors.slice(0,3));
await stop();
