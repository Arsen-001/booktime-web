import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phone.waitForTimeout(1000);
  const row = phone.locator('button', { hasText: 'Новая запись' }).locator('..');
  const btns = row.locator('button');
  const n = await btns.count();
  console.log('row buttons:', n);
  for (let i=0;i<n;i++) {
    console.log(i, await btns.nth(i).getAttribute('aria-label'), (await btns.nth(i).innerText()).slice(0,20));
  }
  const last = btns.last();
  await last.click();
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: `${OUT}/71-phone-header-last-btn.png` });
  console.log('dialog text:', await phone.locator('[role="dialog"],[role="menu"]').first().innerText().catch(()=>'(none)'));
  await phone.close();
} finally {
  await browser.close();
  release();
}
