import { start, stop, open, as, text, shot, db } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/online`, { device: 'desktop' });
const d = await db(page); const l = d.areas.online.links.find(x=>x.businessId==='biz_nuri'); console.log('link', JSON.stringify(l).slice(0,600));
await as(page, 'owner', `/biz/online/links/${l.id}`);
const t = await text(page); console.log(t.slice(0,5000).replace(/\n/g,' | '));
const sw = await page.getByRole('switch').evaluateAll(els=>els.map(e=>(document.getElementById(e.getAttribute('aria-labelledby')+'')?.innerText||e.getAttribute('aria-label')||e.closest('label')?.innerText||'?').trim().slice(0,40)+':'+e.getAttribute('aria-checked'))); console.log(sw);
await stop();
