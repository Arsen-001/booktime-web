// Обход всех страниц браузером — ищем ТОЛЬКО падения экрана (не полная проверка: та — после бэкенда, docs/TESTING-AFTER-BACKEND.md).
//   node scripts/crash-sweep.mjs            → qa/crash-sweep.json + сводка в консоль
// 26.09.2026: пользователь нашёл пустую /biz/waitlist (экран падал под React Compiler) и попросил пройти все страницы.
// Статические маршруты — из src/app; для маршрутов с параметром ([id]) берём первую подходящую ссылку, найденную на обойдённых страницах.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const BASE = process.env.BASE || 'http://localhost:3710';
const WORKERS = 4; // scripts/pw-slots.mjs: не больше 4 браузеров на компьютер

function pages(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) pages(p, out);
    else if (e.name === 'page.tsx') out.push(p);
  }
  return out;
}
const routes = pages(path.join(root, 'src/app')).map(f => {
  let r = f.slice(path.join(root, 'src/app').length).replace(/\/page\.tsx$/, '').replace(/\/\([^/]+\)/g, '');
  return r || '/';
});
const staticRoutes = [...new Set(routes.filter(r => !r.includes('[')))].sort();
const dynamicPatterns = [...new Set(routes.filter(r => r.includes('[')))].map(r => ({
  route: r,
  re: new RegExp('^' + r.replace(/\[\[?\.\.\.[^\]]+\]\]?/g, '.+').replace(/\[[^\]]+\]/g, '[^/?#]+') + '(?:[?#].*)?$'),
}));

function persona(r) {
  if (r.startsWith('/platform')) return 'platform';
  if (r.startsWith('/biz')) return 'owner';
  if (r.startsWith('/dev')) return null;
  return 'client';
}

const found = new Map(); // dynamic route → sample href
const results = [];

async function visit(ctx, url, route) {
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  p.on('console', m => { if (m.type() === 'error' && /экран упал|Unhandled|TypeError|ReferenceError/.test(m.text())) errs.push(m.text().split('\n')[0].slice(0, 200)); });
  let status = 0;
  try {
    const res = await p.goto(BASE + url, { waitUntil: 'networkidle', timeout: 60000 });
    status = res ? res.status() : 0;
    await p.waitForTimeout(1500);
  } catch (e) { errs.push('GOTO ' + e.message.slice(0, 120)); }
  const text = (await p.locator('body').innerText().catch(() => '')).trim();
  const crashed = /Что-то пошло не так|Something went wrong|экран упал/i.test(text);
  const hrefs = await p.$$eval('a[href^="/"]', as => as.map(a => a.getAttribute('href'))).catch(() => []);
  for (const h of hrefs) for (const d of dynamicPatterns) if (!found.has(d.route) && d.re.test(h)) found.set(d.route, h);
  await p.close();
  const bad = errs.length > 0 || crashed || text.length < 20 || status >= 500;
  results.push({ route, url, status, bad, crashed, empty: text.length < 20, errors: [...new Set(errs)].slice(0, 3) });
}

async function pool(items, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: WORKERS }, async () => { while (i < items.length) { const it = items[i++]; await fn(it); } }));
}

const browser = await chromium.launch();
const ctxs = {};
for (const who of ['owner', 'client', 'platform']) ctxs[who] = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const withQ = (r, who) => r + (r.includes('?') ? '&' : '?') + 'demo=' + who;
await pool(staticRoutes.filter(persona), r => visit(ctxs[persona(r)], withQ(r, persona(r)), r));
const dyn = dynamicPatterns.map(d => d.route).filter(r => found.has(r) && persona(r));
await pool(dyn, r => visit(ctxs[persona(r)], withQ(found.get(r), persona(r)), r));
await browser.close();

const notReached = dynamicPatterns.map(d => d.route).filter(r => !found.has(r));
const bad = results.filter(r => r.bad);
fs.writeFileSync(path.join(root, 'qa/crash-sweep.json'), JSON.stringify({ at: new Date().toISOString(), total: results.length, bad, notReached, results }, null, 1));
console.log(`страниц пройдено: ${results.length} (статических ${staticRoutes.filter(persona).length}, с параметром ${dyn.length}); с параметром не нашлось ссылки: ${notReached.length}`);
console.log(`упали или пустые: ${bad.length}`);
for (const b of bad) console.log(`✗ ${b.url}  ${b.status} ${b.crashed ? 'ЭКРАН УПАЛ' : ''}${b.empty ? 'ПУСТО' : ''} ${b.errors.join(' | ')}`);
