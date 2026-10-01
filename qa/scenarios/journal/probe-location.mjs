import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-g3-1-m1/probe';
fs.mkdirSync(OUT, { recursive: true });

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=network&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const select = page.locator('button:has-text("Все филиалы")').first();
  await select.click({ force: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/06-location-dropdown-open.png` });
  const opts = await page.locator('[role="option"]').allTextContents();
  console.log('options:', opts);
  if (opts.length > 1) {
    await page.locator('[role="option"]').nth(1).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/07-location-switched.png` });
  }
  await ctx.close();
} catch (e) {
  console.log('ERROR', e.message);
} finally {
  await browser.close();
  release();
}
