import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByText('Новая запись').click();
  await page.waitForTimeout(400);
  await page.getByText('Обычная запись').click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: /^Маникюр классический/ }).click();
  await page.waitForTimeout(400);
  await page.locator('button', { hasText: /^Снятие покрытия/ }).click();
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 10) el.scrollTop = 0;
    });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/_duration-after-scroll-up.png' });
} finally {
  await browser.close();
  release();
}
