import { start, stop, open, as, text, shot, db } from './lib.mjs';
await start();
const { page } = await open('client', `/`, { device: 'phone' });
await page.waitForTimeout(1500);
const html = await page.locator('header, main').first().evaluate(e=>e.outerHTML.slice(0,100));
const links = await page.locator('a').evaluateAll(els=>els.map(e=>e.getAttribute('href')+'|'+(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,30)).slice(0,15)); console.log(links);
await shot(page, 'k9-home');
await as(page, 'client', '/notifications'); await shot(page, 'k9-feed');
await stop();
