import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('client', `/masters/st_nuri_mariam`, { device: 'phone' });
let t = await text(page); console.log('MARIAM', t.slice(0,700).replace(/\n/g,' | '));
const ctr = await page.locator('main button, main a').evaluateAll(els=>els.map(e=>(e.innerText||e.getAttribute('aria-label')||'').trim()).filter(Boolean)); console.log('controls', ctr.slice(0,30));
await shot(page, 'k1-master-card');
await stop();
