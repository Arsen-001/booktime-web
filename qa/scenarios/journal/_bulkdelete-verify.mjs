import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/records?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const checkboxes = page.locator('table input[type="checkbox"], tbody input[type="checkbox"]');
  await checkboxes.nth(1).click();
  await checkboxes.nth(2).click();
  await page.waitForTimeout(300);
  await page.getByText(/Удалить выбранные/).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Удалить$/ }).click();
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/shots/journal/b04-records/bulk_after_reload.png' });
} finally {
  await browser.close();
  release();
}
