import { start, stop, open, as, text, shot, db } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/journal?date=2026-09-30`, { device: 'desktop' });
const d = await db(page);
const b = d.core.bookings.find(x=>x.id==='bk_1991'); const c = d.core.clients.find(x=>x.id===b.clientId);
console.log(b.start, b.staffId, c.name, 'field', c.noShowCount, 'real', d.core.bookings.filter(x=>x.clientId===c.id&&x.status==='no_show'&&!x.deletedAt).length, 'arrived', d.core.bookings.filter(x=>x.clientId===c.id&&x.status==='arrived'&&!x.deletedAt).length);
const blocks = page.locator('[data-testid="booking-block"]'); const n = await blocks.count();
for (let i=0;i<n;i++){ const tx = await blocks.nth(i).innerText(); if (tx.includes(b.start.slice(11,16)) ) { await blocks.nth(i).locator('button[aria-label="Статус и оплата"], button:has-text("Статус и оплата")').first().click().catch(async()=>{ await page.getByRole('button',{name:'Статус и оплата'}).nth(i).click(); }); break; } }
await page.waitForTimeout(800);
console.log('hovercard', (await page.locator('body').innerText()).match(/[^\n]*\n[^\n]*\nВизитов: \d+ · Не пришёл: \d+[^\n]*/)?.[0]?.replace(/\n/g,' | '));
await shot(page, 'c8-hovercard-noshow');
await stop();
