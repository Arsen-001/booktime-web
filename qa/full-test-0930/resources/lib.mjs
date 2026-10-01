import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
export const BASE = 'http://localhost:3710';
export const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/resources';
let browser, release;
export async function start() { if (browser) return browser; release = await acquireBrowserSlot(); browser = await chromium.launch(); return browser; }
export async function stop() { if (globalThis.__keep) return; try { await browser?.close(); } finally { release?.(); browser = undefined; } }
export async function ctx({ device = 'desktop', time = null } = {}) {
  const phone = device === 'phone';
  const c = await browser.newContext(phone
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 } });
  if (time) await c.clock.install({ time: new Date(time) });
  c.timed = Boolean(time);
  return c;
}
export async function open(c, path, { persona = 'owner', lang = 'ru', query = '' } = {}) {
  const p = c.pages()[0] ?? await c.newPage();
  if (!p.errors) {
    p.errors = [];
    p.on('console', (m) => { if (m.type() === 'error') p.errors.push(m.text().slice(0, 300)); });
    p.on('pageerror', (e) => p.errors.push('PAGEERROR ' + e.message.slice(0, 300)));
  }
  const sep = path.includes('?') ? '&' : '?';
  await p.goto(`${BASE}${path}${sep}demo=${persona}&lang=${lang}${query ? '&' + query : ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  if (c.timed && !c.resumed) { await c.clock.resume(); c.resumed = true; }
  await p.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1500);
  return p;
}
export async function goto(p, path) {
  await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(1200);
}
export async function shot(p, name, full = false) { await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); }
export const area = (p, a) => p.evaluate((a) => JSON.parse(localStorage.getItem('bp-mock-db:area:' + a) || 'null'), a);
