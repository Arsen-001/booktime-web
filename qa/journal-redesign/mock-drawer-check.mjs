import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/journal-redesign/drawer-check-390.png' });
  console.log('errors:', errs.join(' | ') || 'none');
} finally {
  await browser.close();
  release();
}
