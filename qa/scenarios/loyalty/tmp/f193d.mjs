import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const block = page.locator('[data-testid="booking-block"]').filter({ hasText: 'Гость Нелли' });
  await block.first().scrollIntoViewIfNeeded();
  await block.first().click({ force: true });
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: 'Оплата', exact: true }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193d-payment.png', fullPage: true });
  const t = await page.locator('body').innerText();
  console.log(t.slice(t.indexOf('Оплата'), t.indexOf('Оплата')+1500));
} finally { await browser.close(); release(); }
