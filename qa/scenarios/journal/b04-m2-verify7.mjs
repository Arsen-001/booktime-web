import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phone.waitForTimeout(1000);
  await phone.getByRole('button', { name: 'Календарь и быстрые действия' }).click();
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: `${OUT}/76-phone-calendar-panel.png` });
  console.log('panel text:', await phone.locator('[role="dialog"]').first().innerText().catch(()=>'(none)'));
  const list = phone.getByText('Список услуг', { exact: false });
  console.log('Список услуг found in panel:', await list.count());
  if (await list.count()) {
    await list.first().click();
    await phone.waitForTimeout(500);
    await phone.screenshot({ path: `${OUT}/77-phone-services-list.png` });
  }
  await phone.close();

  // Also check F-01-011 day summary content on phone via "Ещё действия"
  const phone2 = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone2.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phone2.waitForTimeout(1000);
  await phone2.getByRole('button', { name: 'Ещё действия' }).click();
  await phone2.waitForTimeout(400);
  await phone2.getByText('0', { exact: false }).first().click().catch(()=>{});
  await phone2.waitForTimeout(400);
  await phone2.screenshot({ path: `${OUT}/78-phone-day-summary.png` });
  console.log('summary sheet:', await phone2.locator('[role="dialog"]').last().innerText().catch(()=>'(none)'));
  await phone2.close();
} finally {
  await browser.close();
  release();
}
