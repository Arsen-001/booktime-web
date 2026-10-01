import { chromium } from 'playwright';
import fs from 'node:fs';
const S = new URL('./old-db/', import.meta.url).pathname; // снимок localStorage старой демо-базы владельца (28.09), не в git
const ls = JSON.parse(fs.readFileSync(S + 'localStorage.json', 'utf8'));
const routes = fs.readFileSync(S + 'routes.txt', 'utf8').trim().split('\n');
const b = await chromium.launch();
const bad = [];
async function run([u, sphere, persona]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: 'demo_sphere', value: sphere, url: 'http://localhost:3710' }, { name: 'demo_persona', value: persona, url: 'http://localhost:3710' }]);
  await ctx.addInitScript((d) => { if (!sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(d)) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, ls);
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', (e) => errs.push((e.stack || e.message).split('\n').slice(0, 3).join(' | ')));
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && /экран упал|TypeError|ReferenceError|Rendered (more|fewer) hooks/.test(t)) errs.push(t.split('\n').slice(0, 3).join(' | ').slice(0, 400)); });
  try { await p.goto('http://localhost:3710' + u, { waitUntil: 'domcontentloaded', timeout: 120000 }); } catch (e) { errs.push('GOTO ' + e.message.slice(0, 100)); }
  for (let i = 0; i < 10; i++) { await p.waitForTimeout(1000); const t = await p.locator('body').innerText().catch(() => ''); if (/Не удалось загрузить/.test(t)) { errs.push('FAIL-SCREEN'); break; } if (i > 4 && t.length > 300) break; }
  if (errs.length) bad.push({ u, sphere, persona, errs: [...new Set(errs)].slice(0, 2) });
  await ctx.close();
}
const combos = [...['nails','barber','hair','cosmetology','massage','dental','fitness','carwash','general'].map(s => [s,'owner']), ...['individual','admin','master','network'].map(p => ['barber',p])];
const q = combos.flatMap(([s,p]) => routes.map(u => [u,s,p])); let done = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) { await run(q.shift()); done++; if (done % 200 === 0) console.error('done', done, 'bad', bad.length); } }));
fs.writeFileSync(S + 'old-db-sweep.json', JSON.stringify(bad, null, 1));
console.log('total', done, 'bad', bad.length);
const byErr = {}; for (const x of bad) { const k = x.errs.join(' || ').replace(/https?:[^ )]+/g,'').slice(0, 220); (byErr[k] ||= []).push(x.u + ' [' + x.sphere + '/' + x.persona + ']'); }
for (const [k, v] of Object.entries(byErr)) console.log(v.length + 'x ' + k + '\n   ' + v.slice(0, 6).join(', '));
await b.close();
