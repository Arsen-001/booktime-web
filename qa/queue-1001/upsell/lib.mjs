// Общее для сценариев допродажи: браузер через ограничитель, режим mock/api, язык, устройство
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
export const DIR = '/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001/upsell/shots';
export const BASE = 'http://localhost:3710';
export async function open({ mode = 'mock', lang = 'ru', device = 'desktop', role = 'owner' } = {}) {
  const vp = device === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: vp, ...(device === 'phone' ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  const cookies = [{ name: 'bt_data', value: mode, domain: 'localhost', path: '/' }, { name: 'lang', value: lang, domain: 'localhost', path: '/' }];
  if (mode === 'api' && role) cookies.push(...JSON.parse(fs.readFileSync(new URL('./sessions.json', import.meta.url)))[role]);
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('response', (x) => { if (x.status() >= 400 && !x.url().includes('_next')) errors.push(`HTTP ${x.status()} ${x.url().slice(0, 160)}`); });
  const shot = async (name, full = false) => page.screenshot({ path: `${DIR}/${name}-${mode}-${lang}-${device}.png`, fullPage: full });
  const close = async () => { await browser.close(); release(); };
  return { page, ctx, errors, shot, close, mode, lang, device };
}
export const settle = async (page, ms = 1200) => { await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(ms); };
