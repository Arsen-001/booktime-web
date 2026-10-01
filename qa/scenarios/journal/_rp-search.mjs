import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('[data-f="F-01-017"]').click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Поиск по имени или телефону"]').fill('846');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa/shots/journal/b04-header/_rp-search-846.png' });
  await page.locator('input[placeholder="Поиск по имени или телефону"]').fill('Гаяне');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa/shots/journal/b04-header/_rp-search-name.png' });
  const firstResult = page.locator('button', { hasText: 'Гаяне' }).first();
  if (await firstResult.count()) {
    await firstResult.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'qa/shots/journal/b04-header/_rp-client-selected.png' });
  }
} finally {
  await browser.close();
  release();
}
