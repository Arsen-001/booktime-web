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
  await page.getByText('Загрузить из Excel').click();
  await page.waitForTimeout(400);
  const textarea = page.locator('textarea');
  await textarea.fill('05.11.2026 09:00;+37493999888;Импорт Клиент;Стрижка;12000;0;пришел');
  await page.getByRole('button', { name: 'Загрузить' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/shots/journal/b04-records/import_result.png' });
  // search for the imported client in the records list
  await page.waitForTimeout(500);
  const found = await page.getByText('Импорт Клиент').count();
  console.log('found imported client rows:', found);
} finally {
  await browser.close();
  release();
}
