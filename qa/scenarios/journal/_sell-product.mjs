import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByText('Продать').click();
  await page.waitForTimeout(300);
  await page.getByText('Товар', { exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/shots/journal/b04-header/sell_product_result.png' });
  console.log('url:', page.url());
} finally {
  await browser.close();
  release();
}
