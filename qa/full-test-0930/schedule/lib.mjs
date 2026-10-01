import { chromium } from '/Users/arsen/WebstormProjects/booking-platform/node_modules/playwright/index.mjs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
export const BASE = 'http://localhost:3710';
export const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/schedule';
export async function withBrowser(fn) {
  const release = await acquireBrowserSlot({ timeoutMs: 3 * 60 * 60_000 });
  const browser = await chromium.launch();
  try { return await fn(browser); } finally { await browser.close(); release(); }
}
export async function ctx(browser, { persona = 'owner', device = 'desktop', lang = 'ru', extra = '' } = {}) {
  const c = await browser.newContext(device === 'phone'
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  const page = await c.newPage();
  page.setDefaultNavigationTimeout(240000);
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(`${BASE}/?demo=${persona}&lang=${lang}${extra}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.addStyleTag({ content: '[data-demo-fab]{display:none!important}' }).catch(() => {});
  return { c, page, errors };
}
export async function go(page, path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(800);
}
export async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png` }); }
