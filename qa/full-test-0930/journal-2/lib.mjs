import { chromium } from '/Users/arsen/WebstormProjects/booking-platform/node_modules/playwright/index.mjs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
export const BASE = 'http://localhost:3710';
export const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal-2';
export async function withBrowser(fn) {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try { await fn(browser); } finally { await browser.close(); release(); }
}
export async function openPage(browser, { persona = 'owner', device = 'desktop', lang = 'ru', route = '/biz/journal', extra = '' } = {}) {
  const phone = device === 'phone';
  const ctx = await browser.newContext(phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(`${BASE}${route}${route.includes('?') ? '&' : '?'}demo=${persona}&empty=0&sphere=nails&lang=${lang}&theme=light${extra}`, { waitUntil: 'networkidle' }).catch(()=>{});
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(()=>{});
  return page;
}
export async function goto(page, route) {
  const u = new URL(page.url()); const keep = new URLSearchParams(); for (const k of ['demo','empty','sphere','lang','theme','api']) if (u.searchParams.get(k)) keep.set(k, u.searchParams.get(k)); const q = '?' + keep.toString();
  await page.goto(`${BASE}${route}${route.includes('?') ? '&' + q.slice(1) : q}`, { waitUntil: 'networkidle' }).catch(()=>{});
  await page.waitForTimeout(1000);
}
export async function fids(page) {
  return page.evaluate(() => [...new Set([...document.querySelectorAll('[data-f]')].filter(e => e.getClientRects().length).flatMap(e => e.getAttribute('data-f').split(/[ ,]+/)))].sort());
}
export async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png` }); }
export async function text(page) { return page.evaluate(() => document.body.innerText); }
