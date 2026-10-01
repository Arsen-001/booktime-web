// Проход по всем экранам приложения клиента (раздел client): ошибки страницы, вылет по ширине, мелкие зоны нажатия.
//   node qa/capp-walk.mjs [--lang ru] [--only phone|desktop] [--shots <dir>] [--persona client|guest]
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { acquireBrowserSlot } from '../scripts/pw-slots.mjs';
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const BASE = 'http://localhost:3710';
const lang = arg('lang', 'ru');
const persona = arg('persona', 'client');
const shots = arg('shots');
const only = arg('only');
const onlyRoutes = arg('routes');
if (shots) fs.mkdirSync(shots, { recursive: true });
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const devices = { phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, desktop: { viewport: { width: 1440, height: 900 } } };
const q = `demo=${persona}&lang=${lang}&theme=light&empty=0`;

async function discover(page) {
  const out = {};
  await page.goto(`${BASE}/search?${q}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('a[href^="/masters/"]', { timeout: 30000 }).catch(() => {});
  out.master = await page.getAttribute('a[href^="/masters/"]', 'href').catch(() => null);
  if (out.master) {
    await page.goto(`${BASE}${out.master}?${q}`); await page.waitForSelector('a[href^="/places/"]', { timeout: 15000 }).catch(() => {});
    out.place = await page.getAttribute('a[href^="/places/"]', 'href').catch(() => null);
  }
  await page.goto(`${BASE}/bookings?${q}`); await page.waitForSelector('a[href^="/bookings/"]', { timeout: 20000 }).catch(() => {});
  out.booking = await page.getAttribute('a[href^="/bookings/b"], a[href^="/bookings/"]', 'href').catch(() => null);
  await page.goto(`${BASE}/memberships?${q}`); await page.waitForSelector('a[href^="/memberships/"]', { timeout: 15000 }).catch(() => {});
  out.membership = await page.getAttribute('a[href^="/memberships/"]', 'href').catch(() => null);
  await page.goto(`${BASE}/certificates?${q}`); await page.waitForSelector('a[href^="/certificates/"]', { timeout: 15000 }).catch(() => {});
  out.certificate = await page.getAttribute('a[href^="/certificates/"]', 'href').catch(() => null);
  await page.goto(`${BASE}/loyalty-cards?${q}`); await page.waitForSelector('a[href*="/cashback"]', { timeout: 15000 }).catch(() => {});
  out.cashback = await page.getAttribute('a[href*="/cashback"]', 'href').catch(() => null);
  return out;
}

const routesFor = (found) => {
  let routes = ['/', '/search', '/search?free=today', '/bookings', '/favorites', '/profile', '/profile/notifications', '/notifications', '/memberships', '/certificates', '/loyalty-cards', '/diary', '/login', '/register-business', '/book',
    found.master, found.place, found.booking, found.booking && `${found.booking}/reschedule`, found.membership, found.certificate, found.cashback,
    found.master && `/book?staff=${found.master.split('/').pop()}`, found.place && `/book?business=${found.place.split('/').pop()}`, '/masters/nope', '/bookings/nope'].filter(Boolean);
  if (onlyRoutes) routes = onlyRoutes.split(',');
  return routes;
};
const problems = [];
for (const [dev, cfg] of Object.entries(devices)) {
  if (only && only !== dev) continue;
  const ctx = await browser.newContext(cfg);
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  page.setDefaultNavigationTimeout(120000);
  const errs = [];
  const routes = onlyRoutes ? routesFor({}) : routesFor(await discover(page));
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Download the React/.test(m.text())) errs.push('console: ' + m.text().slice(0, 200)); });
  for (const r of routes) {
    errs.length = 0;
    const t0 = Date.now();
    await page.goto(`${BASE}${r}${r.includes('?') ? '&' : '?'}${q}`, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch((e) => errs.push('goto ' + e.message));
    await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' }).catch(() => {});
    // ждём, пока уйдут скелетоны (до 8 с)
    let busy = true; const start = Date.now();
    while (busy && Date.now() - start < 8000) { await page.waitForTimeout(250); busy = await page.evaluate(() => !!document.querySelector('[aria-busy="true"], [data-skeleton]')); }
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
      const overflow = document.documentElement.scrollWidth - innerWidth;
      const small = [];
      for (const el of document.querySelectorAll('a[href], button, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio], input:not([type=hidden]), textarea')) {
        if (el.closest('[data-demo-fab], .sr-only, [aria-hidden=true]') || !vis(el)) continue;
        let t = el; if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type)) t = el.closest('label') || el;
        const r = t.getBoundingClientRect();
        if (r.height < 44 || r.width < 44) small.push(`${t.tagName.toLowerCase()} "${(t.getAttribute('aria-label') || t.textContent || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      const raw = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const s = n.textContent.trim(); if (/^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]+)+$/.test(s) && !/\.(am|com|ru)$/.test(s)) raw.push(s); }
      const cyr = document.documentElement.lang === 'hy' ? [...document.querySelectorAll('main *')].filter((e) => e.children.length === 0 && /[а-яё]{3,}/i.test(e.textContent) && vis(e)).map((e) => e.textContent.trim().slice(0, 40)).slice(0, 8) : [];
      return { overflow, small: [...new Set(small)].slice(0, 12), raw: raw.slice(0, 5), stillBusy: !!document.querySelector('[aria-busy="true"]'), cyr, h1: document.querySelector('h1')?.textContent?.slice(0, 50) };
    });
    const ms = Date.now() - t0;
    const bad = errs.length || m.overflow > 1 || m.raw.length || m.stillBusy || m.cyr.length;
    console.log(`${bad ? '✗' : '·'} ${dev} ${r} ${ms}ms h1="${m.h1 ?? ''}" ${m.overflow > 1 ? 'OVERFLOW ' + m.overflow : ''} ${m.stillBusy ? 'BUSY' : ''} ${errs.length ? 'ERR ' + errs.join(' | ') : ''} ${m.raw.length ? 'RAW ' + m.raw.join(',') : ''} ${m.cyr.length ? 'CYR ' + m.cyr.join(' / ') : ''}`);
    if (m.small.length) console.log(`    small: ${m.small.join('; ')}`);
    if (bad) problems.push(`${dev} ${r}`);
    if (shots) await page.screenshot({ path: `${shots}/${dev}-${r.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: dev === 'phone' });
  }
  await ctx.close();
}
await browser.close(); release();
console.log(`\nИтого проблемных: ${problems.length}`); for (const p of problems) console.log('  ' + p);
