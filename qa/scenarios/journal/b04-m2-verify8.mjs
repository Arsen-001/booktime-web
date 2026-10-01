import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phone.waitForTimeout(1000);
  const hamburger = phone.locator('button svg').first().locator('..');
  await phone.locator('button').first().click();
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: `${OUT}/80-phone-hamburger-menu.png`, fullPage: false });
  const text = await phone.locator('nav, [role="dialog"], aside').first().innerText().catch(()=>'(none)');
  console.log('hamburger content:', JSON.stringify(text).slice(0,800));
  const svcLink = phone.getByText('Список услуг', { exact: false });
  console.log('Список услуг anywhere in menu:', await svcLink.count());
  await phone.close();
} finally {
  await browser.close();
  release();
}
