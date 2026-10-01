import { start, stop, open, as, text, shot, db } from './lib.mjs';
await start();
const { page } = await open('client', '/', { device: 'phone' });
const d = await db(page); console.log('ads', JSON.stringify(d.areas.platform.ads.map(a=>[a.title?.ru ?? a.title, a.placement, a.from ?? a.startDate, a.to ?? a.endDate, a.status])));
let t = await page.locator('body').innerText(); console.log('home has Скидка 20%', t.includes('Скидка 20%'), '| placeholder', t.includes('Здесь будет реклама'));
await as(page, 'guest', '/'); t = await page.locator('body').innerText(); console.log('guest home has banner', t.includes('Скидка 20%'), t.includes('Здесь будет реклама'));
await as(page, 'client', '/search'); t = await page.locator('body').innerText(); console.log('search has Арабкир banner (should not before 28.09)', t.includes('Новые салоны района'));
await shot(page, 'p5-search');
await stop();
