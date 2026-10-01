import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('owner', '/biz/journal', { device: 'desktop' });
const sel = page.locator('select').filter({ has: page.locator('option', { hasText: 'По ресурсам' }) });
await sel.first().selectOption({ label: 'По ресурсам' }); await page.waitForTimeout(2000);
const heads = await page.locator('[data-f*="F-01-018"] .truncate').evaluateAll(els => els.map(e => e.textContent));
log('resource heads', heads);
const d = await db(page);
log('db resources nuri', JSON.stringify(d.core.resources.filter(r=>r.businessId==='biz_nuri').map(r=>[r.name?.ru||r.name, r.instances?.length ?? r.count, (r.instances||[]).map(i=>i.name)])));
// resize check F-01-031 no extra window
await sel.first().selectOption({ label: 'По должностям' }); await page.waitForTimeout(1500);
const h = page.locator('[data-f*="F-01-026"]', { hasText: 'Мариам Е.' }).first().locator('[title="Потянуть, чтобы изменить длительность"]');
log('resize handle', await h.count());
if (await h.count()) {
  await h.scrollIntoViewIfNeeded(); const b = await h.boundingBox();
  await page.mouse.move(b.x + b.width/2, b.y + b.height/2); await page.mouse.down(); await page.mouse.move(b.x + b.width/2, b.y + 40, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(2000);
  log('after resize dialogs', await page.locator('[role=dialog]').count(), 'toast', await toast(page));
  const bb = d.core.bookings.find(x=>x.staffId==='st_nuri_ani' && x.start==='2026-09-25T17:15');
  const d2 = await db(page); const nb = d2.core.bookings.find(x=>x.id===bb.id);
  log('duration', bb.durationMin, '->', nb.durationMin, 'grid label now', (await page.locator('[data-f*="F-01-026"]', { hasText: 'Мариам Е.' }).first().innerText()).split('\n')[0]);
}
// phone
const { page: p2 } = await open('owner', '/biz/journal', { device: 'phone' });
const sb = p2.locator('button[title="Статус и оплата"]').first();
log('phone status btn', await sb.count(), await sb.boundingBox());
await sb.click(); await p2.waitForTimeout(1200);
log('phone card', (await p2.locator('[role=dialog]').last().innerText().catch(()=>'none')).slice(0,200).replace(/\n/g,' | '));
await shot(p2, 'j7-phone-card');
log('ERR', page.errors.slice(0,3), p2.errors.slice(0,3));
await stop();
