import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('[data-testid="booking-block"]').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/_grid-scrolled-15h.png' });
  await page.locator('[data-testid="booking-block"]').first().click();
  await page.waitForTimeout(700);
  await page.getByRole('tab', { name: 'Клиент', exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/_visitor-client-tab.png' });
  await page.getByRole('tab', { name: 'Запись', exact: true }).click();
  await page.waitForTimeout(300);
  await page.locator('text=Записывает другого посетителя').scrollIntoViewIfNeeded().catch(() => {});
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/_visitor-record-tab-scrolled.png' });
} finally {
  await browser.close();
  release();
}
