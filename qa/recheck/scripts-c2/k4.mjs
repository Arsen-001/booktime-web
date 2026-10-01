import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('client', `/bookings/bk_0080`, { device: 'phone' });
await page.getByRole('button', { name: 'Оценить мастера' }).click(); await page.waitForTimeout(1500);
console.log('toasts', await toasts(page)); let t = await text(page); console.log('after star', t.slice(t.indexOf('Понравилось'), t.indexOf('Понравилось')+80).replace(/\n/g,' | '));
await reload(page); t = await text(page); console.log('after reload', t.slice(t.indexOf('Понравилось'), t.indexOf('Понравилось')+80).replace(/\n/g,' | '));
await as(page, 'client', '/masters/st_nuri_ani'); t = await text(page); console.log('ani card', (t.match(/[^\n]*★[^\n]*/g)||[]).join(' / '), (t.match(/[^\n]*(оцен|звёзд)[^\n]*/gi)||[]).join(' / '));
await shot(page, 'k4-ani-card');
// master without visit: no star possible? check Mariam card
await as(page, 'client', '/masters/st_nuri_mariam'); t = await text(page); console.log('mariam has star control', /Оценить/.test(t));
// review
await as(page, 'client', '/bookings/bk_0080');
await page.getByRole('button', { name: 'Оставить отзыв о месте' }).click(); await page.waitForTimeout(800);
const dlg = page.locator('[role=dialog]').last(); await dlg.locator('textarea').fill('Проверка c2: чисто и вовремя'); 
await dlg.getByRole('button', { name: /Отправить/ }).click(); await page.waitForTimeout(1500); console.log('toasts', await toasts(page));
await as(page, 'client', '/places/biz_nuri'); t = await text(page); console.log('place has review', t.includes('Проверка c2'));
await as(page, 'guest', '/b/nuri-nail-studio'); t = await text(page); console.log('web page has review', t.includes('Проверка c2'), '| has any review section', /Отзыв/.test(t));
await shot(page, 'k4-web-page', true);
await stop();
