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
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Уведомления' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa/journal-redesign/desktop-bell-check.png' });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Ещё' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'qa/journal-redesign/desktop-more-check.png' });
  console.log('errors:', errs.join(' | ') || 'none');
} finally {
  await browser.close();
  release();
}
