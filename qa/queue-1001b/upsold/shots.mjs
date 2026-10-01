// Снимки отчёта «По услугам» с колонкой «Допродано»: api (копия сервера :4031 для by-service) и mock (записи сервера
// подложены в моковую базу) × ru/en × 390/1440, плюс открытая подсказка «?». Запись в основную базу заблокирована.
import fs from 'node:fs';
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const DIR = '/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001b/upsold/shots';
const BASE = 'http://localhost:3710';
const API = 'http://localhost:4010';
const S = JSON.parse(fs.readFileSync('/Users/arsen/WebstormProjects/booking-platform/qa/queue-1001/upsell/sessions.json', 'utf8'));
const cookie = S.owner.map((c) => `${c.name}=${c.value}`).join('; ');
const bookings = await (await fetch(`${API}/v1/biz/biz_nuri/bookings?from=2025-09-01&to=2027-01-31`, { headers: { cookie } })).json();
const range = { from: '2026-10-01', to: '2026-10-10' };
const problems = [];

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  for (const mode of ['api', 'mock'])
    for (const lang of ['ru', 'en'])
      for (const device of ['desktop', 'phone']) {
        const phone = device === 'phone';
        const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
        const cookies = [{ name: 'bt_data', value: mode, domain: 'localhost', path: '/' }, { name: 'lang', value: lang, domain: 'localhost', path: '/' }];
        if (mode === 'api') cookies.push(...S.owner);
        await ctx.addCookies(cookies);
        await ctx.route(`${API}/**`, async (route) => {
          const req = route.request();
          if (req.method() !== 'GET' && req.method() !== 'OPTIONS') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
          if (req.url().includes('/reports/by-service')) return route.fulfill({ response: await route.fetch({ url: req.url().replace(API, 'http://localhost:4031') }) });
          return route.continue();
        });
        await ctx.addInitScript((r) => sessionStorage.setItem('bt_reports_period', JSON.stringify({ range: r, staffId: '' })), range);
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
        page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text().slice(0, 200)));
        page.on('response', (x) => x.status() >= 400 && !x.url().includes('_next') && errors.push(`HTTP ${x.status()} ${x.url().slice(0, 120)}`));
        await page.goto(`${BASE}/biz/reports/r/salesByServices`, { waitUntil: 'networkidle' });
        if (mode === 'mock') {
          await page.waitForTimeout(2000);
          await page.evaluate((list) => localStorage.setItem('bp-mock-db:core:bookings', JSON.stringify(list)), bookings);
          await page.reload({ waitUntil: 'networkidle' });
        }
        await page.waitForTimeout(2500);
        const tag = `${mode}-${lang}-${phone ? '390' : '1440'}`;
        await page.screenshot({ path: `${DIR}/report-${tag}.png`, fullPage: true });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 0) problems.push(`${tag}: горизонтальная прокрутка ${overflow}px`);
        // подсказка «?» у колонки
        const tip = page.getByRole('button', { name: lang === 'ru' ? 'Что значит «Допродано»?' : 'What does “Upsold” mean?' }).first();
        await tip.scrollIntoViewIfNeeded();
        await tip.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${DIR}/hint-${tag}.png` });
        if (errors.length) problems.push(`${tag}: ${errors.join(' | ')}`);
        await ctx.close();
      }
} finally {
  await browser.close();
  release();
}
console.log(problems.length ? problems.join('\n') : 'без ошибок консоли/HTTP и без прокрутки вбок');
