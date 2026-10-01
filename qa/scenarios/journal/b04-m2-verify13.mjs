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
  await checkbox.click();
  await desk.waitForTimeout(300);
  const nameInput = dialog.locator('input').filter({ hasText: '' }).last();
  const inputs = dialog.locator('input[type="text"], input:not([type])');
  // find visible empty text input near the checkbox (visitor name)
  const visitorInput = dialog.locator('input[placeholder*="осетител" i], input[placeholder*="мя посетител" i]').first();
  console.log('visitor input count:', await visitorInput.count());
  if (await visitorInput.count()) {
    await visitorInput.fill('Сессия Проверка М2');
  }
  const saveBtn = dialog.getByRole('button', { name: 'Сохранить изменения' }).first();
  await saveBtn.click();
  await desk.waitForTimeout(1000);
  await desk.screenshot({ path: `${OUT}/93-visitor-save-m2.png` });
  // close dialog properly
  await dialog.getByRole('button', { name: 'Закрыть' }).click().catch(async () => { await desk.keyboard.press('Escape'); });
  await desk.waitForTimeout(500);
  // check block text in the SAME page/session
  const blockTextAfter = await block.innerText();
  console.log('block text after save (same session):', JSON.stringify(blockTextAfter));
  // reopen in same session
  await block.click();
  await desk.waitForTimeout(600);
  dialog = desk.getByRole('dialog');
  const visitorTile = dialog.getByText('Посетитель', { exact: false });
  console.log('Посетитель tile count after reopen same session:', await visitorTile.count());
  await desk.screenshot({ path: `${OUT}/94-visitor-reopen-same-session.png` });
  await desk.close();
} finally {
  await browser.close();
  release();
}
