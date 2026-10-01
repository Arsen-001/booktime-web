import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.goto('http://localhost:3710/biz/reports?demo=owner&lang=ru&sphere=nails', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const keys = await page.evaluate(() => Object.keys(localStorage).map((k) => [k, localStorage.getItem(k).length]));
  console.log(keys);
  console.log((await page.innerText('main')).slice(0, 3000));
} finally { await browser.close(); release(); }
