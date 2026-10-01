import { start, stop, open, as, reload, text, shot, db, toasts } from './lib.mjs';
await start();
const { page } = await open('owner', `/biz/notifications/mailings/new`, { device: 'desktop' });
let t = await text(page); console.log('NEW', t.slice(0,1500).replace(/\n/g,' | '));
const ctr = await page.locator('main input, main [role=radio], main [role=checkbox], main [role=switch], main button').evaluateAll(els=>els.map(e=>`${e.tagName}|${e.getAttribute('role')}|${e.type||''}|${(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,40)}|dis=${e.disabled||e.getAttribute('aria-disabled')}|chk=${e.checked??e.getAttribute('aria-checked')}`)); console.log(ctr.join('\n'));
let d = await db(page);
const cls = d.core.clients.filter(c=>c.businessId==='biz_nuri'); const phones = new Set(cls.map(c=>c.phone)); console.log('biz clients', cls.length, 'unique phones', phones.size, 'with app', cls.filter(c=>c.appUserId).length, 'blacklisted', cls.filter(c=>c.blacklisted||c.blocked).length);
await stop();
