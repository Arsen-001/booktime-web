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
  await block.click();
  await desk.waitForTimeout(500);
  let dialog = desk.getByRole('dialog');
  const checkbox = dialog.getByText('Записывает другого посетителя', { exact: false }).first();
  await checkbox.scrollIntoViewIfNeeded();
  await checkbox.click();
  await desk.waitForTimeout(300);
  const visitorInput = dialog.locator('input[placeholder*="осетител" i]').first();
  await visitorInput.fill('Сессия ПроверкаМ2Б');
  await desk.waitForTimeout(200);
  const saveBtn = dialog.getByRole('button', { name: 'Сохранить изменения' }).first();
  await saveBtn.click();
  await desk.waitForTimeout(1000);
  const closeBtn = dialog.getByRole('button', { name: 'Закрыть' }).first();
  if (await closeBtn.count()) await closeBtn.click(); else await desk.keyboard.press('Escape');
  await desk.waitForTimeout(500);
  await desk.screenshot({ path: `${OUT}/95-grid-after-visitor-save.png` });
  const blockText = await block.innerText();
  console.log('grid block text:', JSON.stringify(blockText));
  await block.click();
  await desk.waitForTimeout(600);
  dialog = desk.getByRole('dialog');
  // scroll full dialog and screenshot in pieces
  await dialog.evaluate((el) => { el.scrollTop = 0; });
  await desk.screenshot({ path: `${OUT}/96-reopen-top.png` });
  const dlgBox = await dialog.boundingBox();
  await desk.mouse.wheel(0, 400);
  await desk.waitForTimeout(200);
  await desk.screenshot({ path: `${OUT}/97-reopen-scrolled.png` });
  const fullText = await dialog.innerText();
  console.log('full dialog text:', JSON.stringify(fullText));
  await desk.close();
} finally {
  await browser.close();
  release();
}
