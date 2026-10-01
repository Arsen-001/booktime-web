import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('response', (res) => { if (res.status() >= 400) console.log('[bad response]', res.status(), res.url()); });
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByText('Маникюр с покрытием').first().click();
  await page.waitForTimeout(700);
  const dialog = page.getByRole('dialog');
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/hist4_open.png' });
  await dialog.getByRole('button', { name: 'Пришёл', exact: true }).click();
  await page.waitForTimeout(300);
  await dialog.getByRole('button', { name: 'Сохранить изменения' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/hist4_after.png' });
} finally {
  await browser.close();
  release();
}
