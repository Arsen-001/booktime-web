import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/records?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByText('Операции с Excel').click();
  await page.waitForTimeout(300);
  await page.getByText('Выгрузить в Excel').click();
  await page.waitForTimeout(400);
  await page.fill('input[placeholder="Email для ссылки"]', 'owner@test.com');
  await page.getByRole('button', { name: 'Выгрузить' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'qa/shots/journal/b04-records/export_after.png' });
} finally {
  await browser.close();
  release();
}
