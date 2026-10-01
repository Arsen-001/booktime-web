import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByText('Новая запись').click();
  await page.waitForTimeout(400);
  await page.getByText('Пакет услуг').click();
  await page.waitForTimeout(700);
  const dialog = page.getByRole('dialog');

  // switch to parallel FIRST (both selects editable), then set both to Ani
  await dialog.getByText('Параллельно').click();
  await page.waitForTimeout(400);
  const staffBtn1 = dialog.locator('button[role="combobox"]').nth(1);
  await staffBtn1.click();
  await page.waitForTimeout(300);
  await page.locator('text=Ани Саргсян').last().click();
  await page.waitForTimeout(400);
  const staffBtn2 = dialog.locator('button[role="combobox"]').nth(3);
  await staffBtn2.click();
  await page.waitForTimeout(300);
  await page.locator('text=Ани Саргсян').last().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/pkg4_both_ani.png' });

  await page.fill('input[placeholder="91 234 567"]', '77008844');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/pkg4_slots.png' });
} finally {
  await browser.close();
  release();
}
