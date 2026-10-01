import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal-g3-1-m1/probe';

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/records?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const tabsHtml = await page.locator('text=Отменённые').all();
  for (const el of tabsHtml) {
    console.log('tag:', await el.evaluate(e => e.outerHTML.slice(0, 150)));
  }
  await page.locator('text="Отменённые"').last().click({ force: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/14-records-cancelled.png` });
  const rows = await page.locator('tbody tr, [role="row"]').count();
  console.log('cancelled rows:', rows);
  // click pencil to open a record
  const pencil = page.locator('[aria-label*="дактир"], button svg').first();
  await page.locator('table').first().hover();
  await ctx.close();
} catch (e) {
  console.log('ERROR', e.message);
} finally {
  await browser.close();
  release();
}
