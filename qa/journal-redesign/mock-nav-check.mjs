import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.goto('http://localhost:3710/biz/clients?lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/journal-redesign/clients-after-journal.png' });
  console.log('errors:', errs.join(' | ') || 'none');
} finally {
  await browser.close();
  release();
}
