import { start, stop, open, go, text, shot, db, settle } from './lib.mjs';
const log = (...a) => console.log(...a);
await start();
const { page } = await open('guest', '/b/nuri-nail-studio/book', { device: 'desktop' });
// set up page with same content: use setContent-ish: navigate to a booking page requires booking; instead test anchor behaviour on this origin
const res = await page.evaluate(() => { const a = document.createElement('a'); a.href = 'data:text/calendar;charset=utf-8,BEGIN%3AVCALENDAR%0AEND%3AVCALENDAR'; a.textContent='x'; a.id='caltest'; document.body.appendChild(a); return true; });
const dl = page.waitForEvent('download', { timeout: 5000 }).then(d => 'download: ' + d.suggestedFilename()).catch(() => 'no download');
await page.click('#caltest').catch(e=>log('click err', e.message));
await page.waitForTimeout(2000);
log(await dl, 'url now', page.url().slice(0,60));
log('ERR', page.errors.slice(0,3));
await stop();
