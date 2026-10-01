import { start, stop, open, go, as, text, shot } from './lib.mjs';
// usage: node ex.mjs persona route1 route2 ...   (env N, B, DEV)
const [persona, ...routes] = process.argv.slice(2);
await start();
let ctx, page;
for (const r of routes) {
  if (!page) ({ context: ctx, page } = await open(persona, r, { device: process.env.DEV || 'desktop' }));
  else await go(page, r);
  console.log('\n######## ', r, '→', page.url());
  console.log((await text(page)).slice(0, +process.env.N || 2000));
  const btns = await page.$$eval('main button, main a[href], main [role=tab], main [role=switch], main input, main textarea, main [role=combobox], [role=dialog] button', els => els.filter(e=>e.offsetParent!==null).map(e => `${e.tagName}${e.getAttribute('role')?'['+e.getAttribute('role')+']':''}${e.getAttribute('aria-checked')?'('+e.getAttribute('aria-checked')+')':''}${e.getAttribute('href')?'<'+e.getAttribute('href')+'>':''} ${(e.innerText||e.getAttribute('aria-label')||e.placeholder||e.value||'').trim().replace(/\s+/g,' ').slice(0,50)}`));
  console.log('--- controls', btns.length); console.log(btns.slice(0, +process.env.B || 60).join('\n'));
  if (page.errors.length) console.log('ERR', page.errors.slice(0,5));
  await shot(page, 'ex-' + persona + r.replace(/\W+/g,'_'));
}
await stop();
