import { chromium } from '@playwright/test';
const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal/b01-m1';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
const page = await ctx.newPage();
await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/11-mobile-initial.png` });

// click calendar icon to open sheet
try {
  await page.getByLabel('Открыть календарь').click({ timeout: 4000 }).catch(async () => {
    await page.locator('button[aria-label], button').filter({ has: page.locator('svg') }).nth(0);
  });
} catch {}
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/12-mobile-after-calendar-click.png` });
await browser.close();
