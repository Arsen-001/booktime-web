import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-g3-1-m1/probe';

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const btn = page.locator('[data-f~="F-01-011"]').first();
  console.log('F-01-011 count:', await page.locator('[data-f~="F-01-011"]').count());
  await btn.click({ force: true });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/13-day-summary.png` });
  await ctx.close();
} catch (e) {
  console.log('ERROR', e.message);
} finally {
  await browser.close();
  release();
}
