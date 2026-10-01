import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
export const BASE = 'http://localhost:3710';
export const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930';
export async function withBrowser(fn) {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try { await fn(browser); } finally { await browser.close(); release(); }
}
export async function newPage(browser, { persona = 'owner', device = 'desktop', lang = 'ru', sphere = 'nails', api = 'normal', empty = false } = {}) {
  const ctx = await browser.newContext(device === 'phone'
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
    : { viewport: { width: 1440, height: 900 } });
  const c = { demo_persona: persona, demo_sphere: sphere, lang, demo_api: api, demo_empty: empty ? '1' : '0', theme: 'light' };
  await ctx.addCookies(Object.entries(c).map(([name, value]) => ({ name, value, url: BASE })));
  const page = await ctx.newPage(); page.setDefaultNavigationTimeout(180000); page.setDefaultTimeout(30000);
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => page.errors.push('PAGEERROR ' + String(e).slice(0, 300)));
  return { ctx, page };
}
export async function go(page, path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(700);
}
export async function shot(page, dir, name) {
  await page.screenshot({ path: `${OUT}/${dir}/${name}.png` });
}
export async function controls(page) {
  return page.evaluate(() => [...document.querySelectorAll('input,textarea,button,[role=switch],[role=combobox],[role=tab],a')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => `${e.tagName.toLowerCase()}#${e.id || ''}[${e.getAttribute('role') || e.type || ''}] "${(e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || '').trim().slice(0, 50).replace(/\n/g, ' ')}"${e.getAttribute('href') ? ' ->' + e.getAttribute('href') : ''}`));
}
export async function as(page, persona, extra = {}) {
  const c = { demo_persona: persona, demo_empty: '0', ...extra };
  await page.context().addCookies(Object.entries(c).map(([name, value]) => ({ name, value, url: BASE })));
}
