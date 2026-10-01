import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phone.waitForTimeout(1000);
  await phone.mouse.click(34, 32);
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: `${OUT}/82-phone-nav-after-hamburger.png` });
  console.log('svc text found:', await phone.getByText('Список услуг', { exact:false }).count());
  console.log('body text sample:', (await phone.locator('body').innerText()).slice(0,600));
  await phone.close();
} finally {
  await browser.close();
  release();
}
