// Общие помощники сценариев проверяющего client (30.09)
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import path from 'node:path';

export const BASE = 'http://localhost:3710';
export const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/client';
export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };

let shared;
export async function start() {
  // run-all.mjs держит один слот и один браузер на все сценарии (слоты заняты ~20 проверяющими)
  if (globalThis.__KEEP_BROWSER) {
    if (!shared) {
      const release = await acquireBrowserSlot({ timeoutMs: 120 * 60_000 });
      const browser = await chromium.launch();
      shared = { browser, release };
      globalThis.__closeShared = async () => { await browser.close().catch(() => {}); release(); };
    }
    return { browser: shared.browser, done: async () => {} };
  }
  const release = await acquireBrowserSlot({ timeoutMs: 120 * 60_000 });
  const browser = await chromium.launch();
  const done = async () => {
    await browser.close().catch(() => {});
    release();
  };
  return { browser, done };
}

export async function newPage(browser, { device = 'phone', clock } = {}) {
  const ctx = await browser.newContext({
    viewport: device === 'phone' ? PHONE : DESKTOP,
    deviceScaleFactor: device === 'phone' ? 2 : 1,
    isMobile: device === 'phone',
    hasTouch: device === 'phone',
    locale: 'ru-RU',
    timezoneId: 'Asia/Yerevan',
  });
  const page = await ctx.newPage();
  if (clock) await page.clock.install({ time: clock });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300));
  });
  return { ctx, page, errors };
}

export async function go(page, route, persona = 'client', extra = '') {
  const sep = route.includes('?') ? '&' : '?';
  for (let i = 0; ; i++) {
    try {
      await page.goto(`${BASE}${route}${sep}demo=${persona}&lang=ru&theme=light${extra.includes('api=') ? '' : '&api=normal'}${extra}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
      break;
    } catch (e) {
      if (i >= 2) throw e;
      console.log('goto retry', route, String(e.message).slice(0, 80));
    }
  }
  await hydrate(page);
}

export async function hydrate(page) {
  await page
    .waitForFunction(() => {
      const el = document.querySelector('main button, main a, button');
      return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps'));
    }, null, { timeout: 30000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

export async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p });
  return p;
}

export const text = (page) => page.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText);

/** Коллекция ядра из localStorage */
export async function coreGet(page, coll) {
  await page.waitForTimeout(700);
  return page.evaluate((c) => {
    const raw = localStorage.getItem(`bp-mock-db:core:${c}`);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j.state ?? j.data ?? j;
  }, coll);
}
export async function areaGet(page, area) {
  await page.waitForTimeout(700);
  return page.evaluate((a) => {
    const raw = localStorage.getItem(`bp-mock-db:area:${a}`);
    return raw ? JSON.parse(raw) : null;
  }, area);
}
