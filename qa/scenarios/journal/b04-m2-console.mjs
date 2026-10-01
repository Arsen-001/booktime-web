import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const msgs = [];
  desk.on('console', (m) => { if (m.type()==='warning' || m.type()==='error') msgs.push(m.type()+': '+m.text()); });
  await desk.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await desk.waitForTimeout(800);
  const block = desk.locator('[data-testid="booking-block"]').first();
  await block.click();
  await desk.waitForTimeout(500);
  const dialog = desk.getByRole('dialog');
  const commentBox = dialog.locator('textarea').first();
  await commentBox.fill('m2 console check').catch(()=>{});
  const saveBtn = dialog.getByRole('button', { name: 'Сохранить изменения' }).first();
  await saveBtn.click();
  await desk.waitForTimeout(1000);
  console.log('console warnings/errors during save:', JSON.stringify(msgs));
  await desk.close();
} finally {
  await browser.close();
  release();
}
