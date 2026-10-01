import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('platform', '/platform/visits', { device: 'desktop' });
let d = await db(page);
log('callback today', d.areas.platform.visits.filter(v=>v.callbackAt?.startsWith?.('2026-09-25') || v.callbackDate==='2026-09-25').length, JSON.stringify(d.areas.platform.visits.map(v=>v.callbackAt ?? v.callbackDate).filter(Boolean)));
// moderation approve & reject
await go(page, '/platform/moderation');
await page.getByText('Жалоба на фото работы').first().click(); await page.waitForTimeout(1000);
log('detail', (await page.locator('[role=dialog]').last().innerText()).slice(0,400).replace(/\n/g,' | '));
const rej = page.getByRole('button', { name: /Отклонить/ });
await rej.first().click(); await page.waitForTimeout(800);
log('reject form', (await page.locator('[role=dialog]').last().innerText()).slice(0,500).replace(/\n/g,' | '));
const confirmBtn = page.locator('[role=dialog]').last().getByRole('button', { name: /Отклонить/ }).last();
log('confirm disabled without reason', await confirmBtn.isDisabled());
await confirmBtn.click().catch(()=>{}); await page.waitForTimeout(800);
log('after click w/o reason', await toast(page), ((await page.locator('[role=dialog]').last().innerText()).match(/[^\n]*причин[^\n]*/gi)||[]).slice(0,3));
await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(500);
// approve first pending
await go(page, '/platform/moderation');
await page.getByText('Описание салона').first().click(); await page.waitForTimeout(800);
await page.getByRole('button', { name: /Одобрить/ }).first().click(); await page.waitForTimeout(1500);
log('approve toast', await toast(page));
await page.reload(); await settle(page);
d = await db(page);
log('mod_9 after reload', d.areas.platform.moderationItems.find(x=>x.id==='mod_9')?.status);
// banners
await go(page, '/platform/ads');
log('--- ads\n' + (await text(page)).slice(0, 1200));
log('ads data', JSON.stringify(d.areas.platform.ads?.slice?.(0,6).map(a=>[a.kind,a.title,a.startDate??a.from,a.endDate??a.to,a.status,a.paused])).slice(0,800));
log('ERR', page.errors.slice(0,3));
await stop();
