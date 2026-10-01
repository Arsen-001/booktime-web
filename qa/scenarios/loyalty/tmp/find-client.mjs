import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/clients?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const hrefs = await page.locator('a[href*="/biz/clients/"]').evaluateAll(els => els.map(e => [e.getAttribute('href'), e.textContent]));
  console.log(JSON.stringify(hrefs.slice(0,15)));
} finally {
  await browser.close();
  release();
}
