import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/records?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const checkboxes = page.locator('table input[type="checkbox"], tbody input[type="checkbox"]');
  const count = await checkboxes.count();
  console.log('checkboxes found', count);
  // check first two row checkboxes (skip header 'select all' at index 0)
  await checkboxes.nth(1).click();
  await checkboxes.nth(2).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-records/bulk_selected.png' });
  await page.getByText(/Удалить выбранные/).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa/shots/journal/b04-records/bulk_confirm.png' });
  const confirmBtn = page.getByRole('button', { name: /Удалить/ }).last();
  await confirmBtn.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/shots/journal/b04-records/bulk_after.png' });
} finally {
  await browser.close();
  release();
}
