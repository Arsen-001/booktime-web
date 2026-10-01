import { start, stop, open, as, reload, text, shot, db, toasts, btnTexts } from './lib.mjs';
await start();
const DATE='2026-10-20';
const { page } = await open('owner', `/biz/journal?date=${DATE}`, { device: 'desktop' });
const getB = async id => (await db(page)).core.bookings.find(b=>b.id===id);
// delete bk_2505 with undo
await page.locator('[data-testid="booking-block"]', { hasText: '16:30' }).first().click(); await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Удалить' }).first().click(); await page.waitForTimeout(800);
const dlg = page.locator('[role=alertdialog],[role=dialog]').last(); const dt = await dlg.innerText().catch(()=>''); console.log('after delete click', dt.replace(/\n+/g,' | ').slice(0,200));
const conf = page.getByRole('button', { name: /^Удалить$/ }); if (await conf.count() > 1) { await conf.last().click(); await page.waitForTimeout(800); }
console.log('toasts', await toasts(page));
let b = await getB('bk_2505'); console.log('deleted?', b.deletedAt, b.deletedBy);
const undo = page.getByRole('button', { name: 'Отменить' }).last(); console.log('undo btn', await undo.count());
await undo.click(); await page.waitForTimeout(1500);
b = await getB('bk_2505'); console.log('after undo', b.deletedAt, b.status, 'blocks', await page.locator('[data-testid="booking-block"]').count());
await as(page, 'owner', `/biz/journal?date=${DATE}`); b = await getB('bk_2505'); console.log('after undo+reload', b.deletedAt, 'blocks', await page.locator('[data-testid="booking-block"]').count());
// delete bk_2506 without undo
await page.locator('[data-testid="booking-block"]', { hasText: '19:45' }).first().click(); await page.waitForTimeout(1200);
await page.getByRole('button', { name: 'Удалить' }).first().click(); await page.waitForTimeout(800);
const conf2 = page.getByRole('button', { name: /^Удалить$/ }); if (await conf2.count() > 1) { await conf2.last().click(); }
await page.waitForTimeout(6500);
b = await getB('bk_2506'); console.log('2506 deleted', b.deletedAt, JSON.stringify(b.deletedBy ?? b.deletedByStaffId ?? null));
// check slot freed for client
await as(page, 'client', `/book?staff=st_nuri_sona&service=${b.services[0].serviceId}`);
await page.getByRole('button', { name: /вт, 20 октября/ }).click().catch(e=>console.log('no day btn')); await page.waitForTimeout(1000);
console.log('sona slots 20 oct', (await text(page)).match(/\d\d:\d\d/g));
await as(page, 'owner', '/biz/records');
const t = await text(page); const i = t.indexOf('Удалена'); console.log('records', i, t.slice(Math.max(0,i-300), i+200).replace(/\n/g,' | '));
const del = page.locator('text=Удалена').first(); if (await del.count()) { await del.hover(); await page.waitForTimeout(600); console.log('tooltip', (await page.locator('[role=tooltip]').allInnerTexts()).join(' / ')); }
await shot(page, 'j2-records');
await stop();
