import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('owner', '/biz/clients', { device: 'desktop' });
const rows = async () => (await page.locator('tbody tr').allInnerTexts()).map(r => r.replace(/\s+/g, ' ').trim());
const search = page.getByPlaceholder(/Поиск \(по имени/);
// 1 search by phone
await search.fill('196143'); await page.getByRole('button', { name: 'Найти клиентов' }).click(); await page.waitForTimeout(1500);
log('phone 196143 ->', await rows());
await search.fill('+374 00 196 143'); await page.getByRole('button', { name: 'Найти клиентов' }).click(); await page.waitForTimeout(1500);
log('phone formatted ->', await rows());
await search.fill('client8@example'); await page.getByRole('button', { name: 'Найти клиентов' }).click(); await page.waitForTimeout(1500);
log('email ->', await rows());
const d = await db(page);
const card = Object.entries(d.areas.clients.profiles).find(([id, p]) => p.cardNumber && d.core.clients.find(c=>c.id===id)?.businessId==='biz_nuri');
log('card sample', card?.[0], card?.[1]?.cardNumber);
if (card) { await search.fill(card[1].cardNumber); await page.getByRole('button', { name: 'Найти клиентов' }).click(); await page.waitForTimeout(1500); log('card ->', await rows(), 'expected', d.core.clients.find(c=>c.id===card[0]).name); }
await search.fill('Мэри'); await page.getByRole('button', { name: 'Найти клиентов' }).click(); await page.waitForTimeout(1500);
log('name ->', await rows());
await search.fill(''); await page.getByRole('button', { name: 'Найти клиентов' }).click(); await page.waitForTimeout(1500);
// sort by sold
const hdr = page.locator('thead th', { hasText: 'Продано' });
await hdr.locator('button').first().click().catch(async()=>{ await hdr.click(); }); await page.waitForTimeout(1000);
const s1 = (await rows()).slice(0,8).map(r=>r.match(/(\d[\d\s]*) ֏/)?.[1]);
log('sort1', s1, await hdr.innerText(), await hdr.getAttribute('aria-sort'));
await hdr.locator('button').first().click().catch(async()=>{ await hdr.click(); }); await page.waitForTimeout(1000);
const s2 = (await rows()).slice(0,8).map(r=>r.match(/(\d[\d\s]*) ֏/)?.[1]);
log('sort2', s2, await hdr.getAttribute('aria-sort'));
// verify Мэри Манукян calc
const mary = d.core.clients.find(c=>c.name==='Мэри Манукян' && c.businessId==='biz_nuri');
const mb = d.core.bookings.filter(b=>b.clientId===mary.id);
log('Мэри bookings', JSON.stringify(mb.map(b=>[b.start.slice(0,10), b.status, b.total])));
// segments math
const today = '2026-09-25';
const d30 = '2026-08-26';
const nuri = d.core.clients.filter(c=>c.businessId==='biz_nuri');
let nw=0, rep=0;
for (const c of nuri) { const v = d.core.bookings.filter(b=>b.clientId===c.id && b.status==='arrived' && !b.deletedAt).map(b=>b.start.slice(0,10)).sort(); if (v.length && v[0] >= d30) nw++; if (v.length>=2 && v.at(-1) >= d30) rep++; }
log('expected new', nw, 'repeat', rep);
const subs = d.areas.clients.subscriptions.filter(s=>s.businessId==='biz_nuri' || nuri.some(c=>c.id===s.clientId));
log('subs ending', new Set(subs.filter(s=>s.status==='active' && (s.remainingVisits<=1 || s.expiresAt <= '2026-10-09')).map(s=>s.clientId)).size, 'remaining<=1:', subs.filter(s=>s.status==='active'&&s.remainingVisits<=1).length);
// click segment subscription
await page.getByRole('button', { name: /Заканчивается абонемент/ }).first().click(); await page.waitForTimeout(1500);
const segRows = await rows();
log('seg rows', segRows.length, (await text(page)).match(/\d+–\d+ из \d+/)?.[0]);
log('ERR', page.errors.slice(0,3));
await stop();
