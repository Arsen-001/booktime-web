import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
const toast = async (page) => (await page.locator('[role=status], [role=alert]').allInnerTexts().catch(()=>[])).filter(Boolean);
await start();
const { page } = await open('client', '/bookings/bk_0083/reschedule', { device: 'phone' });
const t = await text(page);
log('--- reschedule\n' + t.slice(0, 1500));
const d0 = await db(page);
const n0 = d0.core.bookings.length;
// pick a slot button with time pattern
const btns = page.getByRole('button', { name: /^\d\d:\d\d$/ });
log('slot buttons', await btns.count(), (await btns.allInnerTexts()).slice(0,10));
const pick = (await btns.allInnerTexts())[1];
await btns.nth(1).click(); await page.waitForTimeout(2500);
log('picked', pick, 'toast', await toast(page), page.url());
await settle(page);
log('--- after\n' + (await text(page)).slice(0, 800));
await page.reload(); await settle(page);
log('--- reload\n' + (await text(page)).slice(0, 800));
const d1 = await db(page);
const b = d1.core.bookings.find(x=>x.id==='bk_0083');
log('bk_0083', b.start, b.status, b.staffId, 'count', n0, '->', d1.core.bookings.length);
// verify slots were only Karen's: compute from db which staff free
await shot(page, 'c5-resched');
// waitlist
await go(page, '/masters/st_nuri_ani');
await page.getByRole('button', { name: 'Сообщить, если освободится' }).click(); await page.waitForTimeout(1000);
log('--- waitlist dialog\n' + (await page.locator('[role=dialog]').allInnerTexts()).join('\n'));
await page.getByRole('button', { name: 'Встать в очередь' }).click(); await page.waitForTimeout(2000);
log('toast', await toast(page));
await go(page, '/bookings');
log('--- bookings wl\n' + (await text(page)).match(/Мой лист ожидания[\s\S]*/)?.[0]);
await page.reload(); await settle(page);
log('--- after reload wl\n' + (await text(page)).match(/Мой лист ожидания[\s\S]*/)?.[0]);
const rm = page.getByRole('button', { name: 'Убрать из листа ожидания' });
log('remove btns', await rm.count());
if (await rm.count()) { await rm.first().click(); await page.waitForTimeout(2000); log('toast', await toast(page)); log('--- after rm\n' + (await text(page)).match(/Мой лист ожидания[\s\S]*/)?.[0]); await page.reload(); await settle(page); log('--- after rm reload\n' + (await text(page)).match(/Мой лист ожидания[\s\S]*/)?.[0]); }
// repeat from past
await page.getByRole('tab', { name: /Прошедшие/ }).click(); await page.waitForTimeout(800);
log('--- past\n' + (await text(page)).slice(0, 900));
await go(page, '/bookings/bk_0080');
log('--- 0080\n' + (await text(page)));
const rep = page.getByRole('link', { name: /Повторить запись/ }).or(page.getByRole('button', { name: /Повторить запись/ }));
log('repeat href', await rep.first().getAttribute('href'));
await rep.first().click(); await settle(page);
log('URL', page.url());
log('--- repeat\n' + (await text(page)).slice(0, 900));
log('ERR', page.errors);
await stop();
