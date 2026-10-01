import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phone.waitForTimeout(1000);
  const menuBtn = phone.locator('button[aria-label*="еню" i], button[aria-label*="навигац" i]').first();
  console.log('menu btn count:', await menuBtn.count(), await menuBtn.getAttribute('aria-label').catch(()=>null));
  if (await menuBtn.count()) {
    await menuBtn.click();
    await phone.waitForTimeout(500);
    await phone.screenshot({ path: `${OUT}/81-phone-nav-menu.png` });
    console.log('svc in menu:', await phone.getByText('Список услуг', { exact:false }).count());
  }
  await phone.close();
} finally {
  await browser.close();
  release();
}
