import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&new=1&staff=st_nuri_ani&start=14:00&date=2026-11-06', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('button', { hasText: /^Маникюр классический/ }).click();
  await page.waitForTimeout(500);
  const phone = page.locator('input[placeholder="91 234 567"]');
  await phone.scrollIntoViewIfNeeded();
  await phone.click();
  await phone.fill('95965289');
  await page.waitForTimeout(700);
  await page.getByText('Нелли Симонян').first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Записать' }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193i-after-record.png' });
  // find any booking block for this staff/day and open the last one added
  const blocks = page.locator('[data-testid="booking-block"]');
  const cnt = await blocks.count();
  console.log('total blocks', cnt);
  await blocks.last().scrollIntoViewIfNeeded();
  await blocks.last().click({ force: true });
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: 'Оплата', exact: true }).click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193i-own-payment.png', fullPage: true });
  const t = await page.locator('body').innerText();
  console.log(t.slice(t.indexOf('Быстрая оплата'), t.indexOf('Быстрая оплата')+1000));
} finally { await browser.close(); release(); }
