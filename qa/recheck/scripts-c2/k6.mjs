import { start, stop, open, as, text, shot, db } from './lib.mjs';
await start();
const { page } = await open('client', `/b/nuri-nail-studio`, { device: 'phone' });
const d = await db(page); console.log('reviews in db', d.areas.client.locationReviews.length);
const all = await page.locator('body').innerText(); console.log('mentions отзыв', (all.match(/[^\n]*[Оо]тзыв[^\n]*/g)||[]).slice(0,5), all.length);
// seeded review for biz_atam: check atam web page
const slug = (d.areas.online?.links||[]); 
await as(page, 'client', '/b/atam-dental'); const a2 = await page.locator('body').innerText(); console.log('atam page', a2.slice(0,120).replace(/\n/g,' | '), '| has seeded review', a2.includes('Уютное место'));
await as(page, 'client', '/places/biz_atam'); const a3 = await text(page); console.log('atam place has seeded review', a3.includes('Уютное место'));
await stop();
