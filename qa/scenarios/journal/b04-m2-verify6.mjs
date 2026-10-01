import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phone.waitForTimeout(1000);
  await phone.getByRole('button', { name: 'Ещё действия' }).click();
  await phone.waitForTimeout(500);
  await phone.screenshot({ path: `${OUT}/72-phone-more-actions-sheet.png` });
  console.log('sheet text:', await phone.locator('[role="dialog"],[role="menu"]').first().innerText().catch(()=>'(none)'));
  // now try clicking an item inside, e.g. "Продать"
  const sellItem = phone.getByText('Продать', { exact: false }).first();
  if (await sellItem.count()) {
    await sellItem.click();
    await phone.waitForTimeout(400);
    await phone.screenshot({ path: `${OUT}/73-phone-sell-submenu.png` });
    console.log('sell submenu:', await phone.locator('[role="dialog"],[role="menu"]').first().innerText().catch(()=>'(none)'));
  }
  await phone.close();

  const phone2 = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phone2.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phone2.waitForTimeout(1000);
  await phone2.getByRole('button', { name: 'Клиенты и чат' }).click();
  await phone2.waitForTimeout(500);
  await phone2.screenshot({ path: `${OUT}/74-phone-clients-chat-panel.png` });
  await phone2.getByRole('button', { name: 'Календарь и быстрые действия' }).click();
  await phone2.waitForTimeout(300);
  await phone2.screenshot({ path: `${OUT}/75-phone-calendar-panel.png` });
  console.log('calendar panel text:', await phone2.locator('[role="dialog"]').first().innerText().catch(()=>'(none)'));
  await phone2.close();
} finally {
  await browser.close();
  release();
}
