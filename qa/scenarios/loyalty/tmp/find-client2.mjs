import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/clients?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const rows = page.locator('[data-testid*="client"]');
  console.log('testid count', await rows.count());
  const buttons = await page.locator('button, [role="row"], li').evaluateAll(els => els.slice(0,5).map(e=>e.outerHTML.slice(0,200)));
  console.log(JSON.stringify(buttons));
} finally {
  await browser.close();
  release();
}
