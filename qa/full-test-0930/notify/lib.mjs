import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
export const BASE = 'http://localhost:3710';
export const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/notify';
export async function withBrowser(fn) {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  try { return await fn(browser); } finally { await browser.close(); release(); }
}
export async function newPage(browser, { persona = 'owner', lang = 'ru', phone = false, api } = {}) {
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(180000);
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => page.errors.push('PAGEERR ' + String(e).slice(0, 300)));
  await page.goto(`${BASE}/biz?demo=${persona}&lang=${lang}${api ? '&api=' + api : ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForTimeout(1500);
  return page;
}
export async function go(page, path, wait = 2500) {
  try { await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 180000 }); } catch (e) { console.log('GOTO-FAIL', path, String(e).slice(0, 120)); }
  await page.waitForTimeout(wait);
  // ждём, пока уйдут скелетоны (до 20 с)
  await page.waitForFunction(() => !document.querySelector('[data-skeleton]'), null, { timeout: 20000 }).catch(() => console.log('SKELETON-STILL', path));
}
export async function text(page) { return (await page.locator('main').first().innerText().catch(() => page.locator('body').innerText())); }
export async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }); }
