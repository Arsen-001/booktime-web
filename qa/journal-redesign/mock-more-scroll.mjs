import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3710/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Ещё' }).click();
  await page.waitForTimeout(400);
  const dialog = page.getByRole('dialog');
  await dialog.locator('div').filter({ hasText: 'Закреплённые' }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/journal-redesign/desktop-more-scrolled.png' });
} finally {
  await browser.close();
  release();
}
