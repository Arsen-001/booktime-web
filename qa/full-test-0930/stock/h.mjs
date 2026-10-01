// Помощник проверяющего склада: один браузер, свой контекст, персона через ?demo=
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import fs from 'node:fs';
export const BASE = 'http://localhost:3710';
export const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/stock';
const VP = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
export async function start() {
  const release = await acquireBrowserSlot();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VP.desktop, permissions: ['clipboard-read','clipboard-write'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 300)); });
  const t = {
    page, ctx, errors,
    async go(persona, route, device = 'desktop', extra = '') {
      await page.setViewportSize(VP[device]);
      const sep = route.includes('?') ? '&' : '?';
      await page.goto(`${BASE}${route}${sep}demo=${persona}&lang=${t.lang ?? 'ru'}&theme=light&api=${t.api ?? 'normal'}${extra}`, { waitUntil: 'domcontentloaded', timeout: 300000 });
      await page.waitForFunction(() => { const el = document.querySelector('main button, main a, button'); return !el || Object.keys(el).some((k) => k.startsWith('__reactProps')); }, null, { timeout: 30000 }).catch(() => {});
      await t.settle();
      await t.closeTours();
    },
    async settle(extra = 400) {
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForFunction(() => ![...document.querySelectorAll('[aria-busy="true"], [data-skeleton]')].some((el) => el.getClientRects().length), null, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(extra);
    },
    async closeTours() {
      for (let i = 0; i < 4; i++) {
        const tour = page.locator('[role="dialog"]').filter({ visible: true }).filter({ hasText: /Шаг \d+ из \d+|Step \d+ of \d+/ });
        if (!(await tour.count())) return;
        await tour.last().getByRole('button', { name: /^(Закрыть|Пропустить|Понятно|Close|Skip|Got it)$/ }).first().click().catch(() => {});
        await page.waitForTimeout(300);
      }
    },
    text: () => page.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText),
    async shot(name, full = false) { await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); },
    async db() {
      await page.waitForTimeout(800);
      return page.evaluate(() => JSON.parse(localStorage.getItem('bp-mock-db') || '{}').state);
    },
    async buttons() { return page.evaluate(() => [...document.querySelectorAll('main button, main a[href], main [role=tab]')].filter(e=>e.getClientRects().length).map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g,' ') + (b.getAttribute('href') ? ' ->' + b.getAttribute('href') : '')).filter(Boolean)); },
    log: (...a) => console.log(...a),
    async end() { await browser.close(); release(); },
  };
  return t;
}
