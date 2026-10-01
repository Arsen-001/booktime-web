import { start, stop, open, text, shot } from './lib.mjs';
await start();
const { page } = await open('owner', '/biz/online');
await page.getByRole('link', { name: 'Настроить' }).first().click(); await page.waitForTimeout(2500);
console.log(page.url());
const t = await text(page); console.log(t.slice(0, 7000));
const c = await page.$$eval('main button, main input, main [role=switch], main [role=combobox], main textarea', els => els.filter(e => e.offsetParent !== null).map(e => `${e.tagName}[${e.getAttribute('role')||e.type||''}]${e.getAttribute('aria-checked')?'('+e.getAttribute('aria-checked')+')':''} ${(e.getAttribute('aria-label')||e.innerText||e.placeholder||e.value||'').trim().replace(/\s+/g,' ').slice(0,50)}`));
console.log('--- controls', c.length); console.log(c.join('\n'));
await stop();
