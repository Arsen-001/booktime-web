import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phone.waitForTimeout(1000);
  const circleBtns = phone.locator('button.rounded-full, button[class*="rounded-full"]');
  const n = await circleBtns.count();
  console.log('circle buttons found:', n);
  for (let i = 0; i < n; i++) {
    const box = await circleBtns.nth(i).boundingBox();
    console.log(i, JSON.stringify(box), await circleBtns.nth(i).getAttribute('aria-label'));
  }
  await circleBtns.last().click();
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: `${OUT}/70-phone-real-more-menu.png` });
  const sheetText = await phone.locator('[role="dialog"], [role="menu"]').first().innerText().catch(() => '(none)');
  console.log('sheet text:', JSON.stringify(sheetText));
  await phone.close();
} finally {
  await browser.close();
  release();
}
