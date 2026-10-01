import { start, stop, open, as, text, shot, db, toasts, pick } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/clients`, { device: 'desktop' });
let d = await db(page);
const ns = d.core.bookings.filter(b=>b.businessId==='biz_nuri' && b.status==='no_show' && !b.deletedAt);
const set = new Set(ns.map(b=>b.clientId)); console.log('no_show clients', set.size, 'no clientId', ns.filter(b=>!b.clientId).length);
await page.getByText('Неявщики', { exact: false }).first().click(); await page.waitForTimeout(1500);
// set page size or gather names across pages
const names = new Set(); for (let p=0;p<3;p++){ const rows = await page.locator('table tbody tr').allInnerTexts(); rows.forEach(r=>names.add(r.split('\t')[0].trim().split('\n')[0])); const nx = page.getByRole('button', { name: /Следующая|Вперёд|›/ }); if (await nx.count() && await nx.first().isEnabled()) { await nx.first().click(); await page.waitForTimeout(800);} else break; }
const expected = [...set].map(id=>d.core.clients.find(c=>c.id===id)?.name);
console.log('list', names.size, 'missing', expected.filter(n=>!names.has(n)), 'extra', [...names].filter(n=>!expected.includes(n)));
// push modal
await as(page, 'owner', `/biz/clients`);
await page.getByRole('button', { name: /Действия/ }).first().click(); await page.waitForTimeout(600);
await page.getByText('Отправить PUSH-уведомление').click(); await page.waitForTimeout(800);
console.log('PUSH', (await page.locator('[role=dialog]').last().innerText()).replace(/\n+/g,' | ').slice(0,300));
await page.keyboard.press('Escape'); await page.waitForTimeout(400);
// category
await page.getByRole('button', { name: /Действия/ }).first().click(); await page.waitForTimeout(600);
await page.getByText('Добавить в категорию').click(); await page.waitForTimeout(800);
const dlg = page.locator('[role=dialog]').last(); console.log('CAT', (await dlg.innerText()).replace(/\n+/g,' | ').slice(0,400));
await shot(page, 'c9-cat');
await stop();
