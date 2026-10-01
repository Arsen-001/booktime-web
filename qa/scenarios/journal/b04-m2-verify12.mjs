import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desk.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await desk.waitForTimeout(1000);
  const block = desk.locator('[data-testid="booking-block"]').nth(1);
  const text1 = await block.innerText();
  console.log('block text (already saved from prior run? fresh reload):', JSON.stringify(text1));
  await block.click();
  await desk.waitForTimeout(600);
  const dialog = desk.getByRole('dialog');
  const visitorTile = dialog.getByText('Посетитель', { exact: false });
  console.log('Посетитель tile count on open:', await visitorTile.count());
  await desk.screenshot({ path: `${OUT}/92-fresh-reopen-full.png`, fullPage: true });
  await desk.close();
} finally {
  await browser.close();
  release();
}
