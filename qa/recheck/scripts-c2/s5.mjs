import { start, stop, open, as, reload, text, shot, db, toasts, btnTexts } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/schedule', { device: 'desktop' });
await page.getByRole('button', { name: 'Показать' }).click(); await page.waitForTimeout(800);
await page.getByRole('button', { name: /рабочий день/ }).nth(3).click(); await page.waitForTimeout(1500);
await as(page, 'admin', '/biz/schedule/history');
console.log('HIST as admin', (await text(page)).slice(0,300));
// staff card warning
await as(page, 'owner', '/dev/ext/staffCard/schedule');
const t = await text(page); console.log('STAFFCARD', t.slice(0,700));
const d = await db(page);
const nowS = '2026-09-25T06:00';
const staffShown = t.match(/(Нарине Акопян|Ани Саргсян|Лилит Мкртчян|Мариам Петросян)/)?.[0];
console.log('shown staff', staffShown);
const byStaff = {}; for (const b of d.core.bookings) { if (b.deletedAt || ['cancelled_by_client','cancelled_by_master','no_show'].includes(b.status)) continue; if (b.start >= '2026-09-25') byStaff[b.staffId]=(byStaff[b.staffId]||0)+1; }
console.log('future active bookings per staff', JSON.stringify(Object.fromEntries(Object.entries(byStaff).filter(([k])=>k.startsWith('st_nuri')))));
const rm = page.getByRole('button', { name: /Убрать/ }).first(); console.log('remove btn', await rm.count());
if (await rm.count()) { await rm.click(); await page.waitForTimeout(800); console.log('DIALOG', (await page.locator('[role=dialog],[role=alertdialog]').last().innerText()).replace(/\n/g,' | ')); }
await shot(page, 's5-staffcard-warn');
await stop();
