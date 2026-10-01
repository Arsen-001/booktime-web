import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('client', `/masters/st_nuri_mariam`, { device: 'phone' });
await page.getByRole('button', { name: 'Подписаться' }).click(); await page.waitForTimeout(1500);
console.log('toasts', await toasts(page), 'btn now', await page.locator('[data-f*="F-14-031"]').first().innerText().catch(()=>'?'));
await as(page, 'client', '/favorites'); await reload(page);
let t = await text(page); console.log('subs has Mariam', t.includes('Мариам Петросян'));
// mute news for Mariam
const row = page.locator('main li, main [role=listitem], main div').filter({ hasText: 'Мариам Петросян' }).filter({ has: page.getByRole('switch') }).last();
const sw = row.getByRole('switch').first(); console.log('switch state', await sw.getAttribute('aria-checked'));
await sw.click(); await page.waitForTimeout(1500); console.log('switch after', await sw.getAttribute('aria-checked'), await toasts(page));
await reload(page);
const row2 = page.locator('main li, main [role=listitem], main div').filter({ hasText: 'Мариам Петросян' }).filter({ has: page.getByRole('switch') }).last();
console.log('switch after reload', await row2.getByRole('switch').first().getAttribute('aria-checked'));
let d = await db(page); console.log('fav rows', JSON.stringify(d.areas.client.favorites.filter(f=>f.appUserId==='au_01' || true).map(f=>[f.targetType,f.targetId,f.newsMuted])));
// unsubscribe
await row2.getByRole('button', { name: 'Отписаться' }).click(); await page.waitForTimeout(1500);
const cd = page.locator('[role=alertdialog]'); if (await cd.count()) { console.log('confirm', (await cd.innerText()).replace(/\n/g,' | ')); await cd.getByRole('button').last().click(); await page.waitForTimeout(1200); }
console.log('toasts', await toasts(page));
await reload(page); t = await text(page); console.log('after unsubscribe+reload has Mariam', t.includes('Мариам Петросян'));
await as(page, 'client', `/masters/st_nuri_mariam`); console.log('master btn', await page.locator('[data-f*="F-14-031"]').first().innerText().catch(()=>'?'), await page.locator('[data-f*="F-14-031"]').first().getAttribute('aria-pressed').catch(()=>'?'));
await stop();
