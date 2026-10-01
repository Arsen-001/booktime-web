import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
export const BASE = 'http://localhost:3710';
export const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/journal';
let browser, release;
export async function start() {
  release = await acquireBrowserSlot({ timeoutMs: 4 * 3600_000 });
  browser = await chromium.launch();
  return browser;
}
export async function stop() { try { await browser?.close(); } finally { release?.(); } }
/** new context; time = ISO with +04:00 or null for real time */
export async function page({ persona = 'owner', device = 'desktop', lang = 'ru', time = null, query = '', sphere } = {}) {
  const phone = device === 'phone';
  const ctx = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  if (time) await ctx.clock.setFixedTime(new Date(time));
  const p = await ctx.newPage();
  p.setDefaultNavigationTimeout(120000); p.setDefaultTimeout(20000);
  p.errors = [];
  p.on('console', (m) => { if (m.type() === 'error') p.errors.push(m.text().slice(0, 300)); });
  p.on('pageerror', (e) => p.errors.push('PAGEERROR ' + (e.stack || e.message).slice(0, 900)));
  const q = `demo=${persona}&lang=${lang}${sphere ? '&sphere=' + sphere : ''}${query ? '&' + query : ''}`;
  await p.goto(`${BASE}/biz/journal?${q}`, { waitUntil: 'domcontentloaded' });
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(1500);
  return p;
}
export async function shot(p, name, full = false) { await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); }
export async function setTime(p, time, wait = 32000) { await p.context().clock.setFixedTime(new Date(time)); await p.waitForTimeout(wait); }
export const txt = async (loc) => (await loc.count()) ? (await loc.first().innerText()).replace(/\n+/g, ' | ') : 'NONE';
export async function step(name, fn) { try { await fn(); } catch (e) { console.log(`!! ${name}: ${e.message.split('\n')[0]}`); } }
