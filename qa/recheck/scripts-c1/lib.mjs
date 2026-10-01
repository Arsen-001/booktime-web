import { createRequire } from 'node:module';
const require = createRequire('/Users/arsen/WebstormProjects/booking-platform/package.json');
const { chromium } = require('@playwright/test');
export const BASE = 'http://localhost:3710';
export const SHOTS = new URL('./shots/', import.meta.url).pathname;
const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 } },
};
let browser;
export async function start() { browser = await chromium.launch(); return browser; }
export async function stop() { await browser?.close(); }
export async function open(persona, route, { device = 'desktop', lang = 'ru', sphere = 'nails', ctx } = {}) {
  const context = ctx ?? await browser.newContext({ ...DEV[device], locale: lang === 'ru' ? 'ru-RU' : 'en-US' });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => { const m='pageerror: ' + e.message.slice(0,200); if(!page.errors.includes(m)) page.errors.push(m); });
  page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') { const x=m.type()+': ' + m.text().slice(0, 200); if(!page.errors.includes(x)) page.errors.push(x);} });
  const sep = route.includes('?') ? '&' : '?';
  await safeGoto(page, `${BASE}${route}${sep}demo=${persona}&sphere=${sphere}&lang=${lang}&theme=light`);
  await settle(page);
  await page.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(()=>{});
  return { context, page };
}
export async function settle(page, ms = 1500) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[data-skeleton]'), null, { timeout: 60000 }).catch(() => { page.errors?.push('SKELETON STILL AFTER 60s'); });
  await page.waitForTimeout(ms);
}
export async function go(page, route) { await safeGoto(page, BASE + route); await settle(page); await page.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(()=>{}); }
export async function shot(page, name, full = false) { await page.screenshot({ path: SHOTS + name + '.png', fullPage: full }); }
export async function text(page, sel = 'main') { const l = page.locator(sel).first(); return (await l.count()) ? (await l.innerText()).replace(/\s+\n/g, '\n') : (await page.locator('body').innerText()); }
export async function db(page) { return page.evaluate(() => { const r = JSON.parse(localStorage.getItem('bp-mock-db') || 'null'); return r?.state ?? r; }); }

export async function safeGoto(page, url) {
  for (let i = 0; i < 3; i++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 }); return; }
    catch (e) { if (i === 2) throw e; await page.waitForTimeout(3000); }
  }
}
