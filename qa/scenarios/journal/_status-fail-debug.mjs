import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  page.on('requestfailed', (req) => console.log('[reqfail]', req.url(), req.failure()?.errorText));
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const block = page.locator('[data-testid="booking-block"]').first();
  await block.click();
  await page.waitForTimeout(700);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Пришёл', exact: true }).click();
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: 'Сохранить изменения' }).click();
  await page.waitForTimeout(1500);
} finally {
  await browser.close();
  release();
}
