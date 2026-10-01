// Помощники сценариев проверяющего network (30.09)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
export const BASE = 'http://localhost:3710';
export const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/network';
export const PHONE = { width: 390, height: 844 };
export const DESKTOP = { width: 1440, height: 900 };

import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
/** Слот ограничителя + свой браузер на один прогон; browser.close() освобождает слот */
export async function connect() {
  if (globalThis.__netBrowser) return globalThis.__netBrowser;
  const release = await acquireBrowserSlot({ timeoutMs: 90 * 60_000 });
  const browser = await chromium.launch();
  const close = browser.close.bind(browser);
  browser.close = async () => { if (process.env.RUNNER) return; await close().catch(() => {}); release(); };
  browser.reallyClose = async () => { await close().catch(() => {}); release(); };
  globalThis.__netBrowser = browser;
  return browser;
}
export async function newPage(browser, { device = 'desktop', lang = 'ru' } = {}) {
  const ctx = await browser.newContext({
    viewport: device === 'phone' ? PHONE : DESKTOP,
    deviceScaleFactor: device === 'phone' ? 2 : 1,
    isMobile: device === 'phone', hasTouch: device === 'phone',
    locale: lang === 'en' ? 'en-US' : 'ru-RU', timezoneId: 'Asia/Yerevan',
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error' || /i18n/.test(m.text())) errors.push(m.type() + ': ' + m.text().slice(0, 300)); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ' ' + r.url().slice(0, 150)); });
  return { ctx, page, errors };
}
export async function go(page, route, { persona = 'network', lang = 'ru', extra = '' } = {}) {
  const sep = route.includes('?') ? '&' : '?';
  await page.goto(`${BASE}${route}${sep}demo=${persona}&lang=${lang}&theme=light${extra}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await hydrate(page);
}
export async function hydrate(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('main button, main a, button');
    return !!el && Object.keys(el).some((k) => k.startsWith('__reactProps'));
  }, null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"], main .animate-pulse'), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
}
export async function shot(page, name, full = false) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: full });
  return p;
}
export const text = (page) => page.evaluate(() => (document.querySelector('main') ?? document.body).innerText);
export async function toasts(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-sonner-toast], [role="status"], [role="alert"]')].map((e) => e.innerText.trim()).filter(Boolean));
}
/** Проверки «как measure»: сырые ключи, вылет по ширине, мелкие кнопки */
export async function audit(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body;
    const t = main.innerText;
    const raw = [...new Set((t.match(/\b(network|common|ui)\.[a-zA-Z]+\.[a-zA-Z.]+/g) ?? []))];
    const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    const small = [...main.querySelectorAll('button, a, [role=button], input, [role=checkbox], [role=switch]')].filter((el) => {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false;
      const s = getComputedStyle(el); if (s.visibility === 'hidden') return false;
      return r.height < 40 && r.width < 40 && !el.closest('[aria-hidden=true]');
    }).map((el) => (el.getAttribute('aria-label') || el.innerText || el.tagName).slice(0, 30)).slice(0, 8);
    const titled = [...main.querySelectorAll('[title]')].map((e) => e.getAttribute('title').slice(0, 40)).slice(0, 5);
    return { raw, overflow, small, titled };
  });
}
export function log(...a) { console.log(...a); }
