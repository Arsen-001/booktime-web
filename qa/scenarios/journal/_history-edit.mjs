import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const block = page.locator('[data-testid="booking-block"]').first();
  await block.click();
  await page.waitForTimeout(700);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Пришёл', exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/hist_status_selected.png' });
  await dialog.getByRole('button', { name: 'Сохранить изменения' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/hist_status_saved.png' });
  await dialog.getByText('История изменений').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/hist_after_edit.png' });
} finally {
  await browser.close();
  release();
}
