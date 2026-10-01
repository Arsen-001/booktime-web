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
  const dialog = desk.getByRole('dialog');
  const visitorCheckbox = dialog.getByText('Записывает другого посетителя', { exact: false }).first();
  console.log('visitor checkbox count:', await visitorCheckbox.count());
  if (await visitorCheckbox.count()) {
    await visitorCheckbox.click();
    await desk.waitForTimeout(300);
    const nameInput = dialog.locator('input[placeholder*="осетител" i]').first();
    if (await nameInput.count()) {
      await nameInput.fill('Проверка Гость');
      await desk.waitForTimeout(200);
    }
    const saveBtn = dialog.getByRole('button', { name: 'Сохранить изменения' }).first();
    await saveBtn.click();
    await desk.waitForTimeout(800);
    await desk.screenshot({ path: `${OUT}/90-visitor-saved.png` });
    // re-open same booking in same session
    await desk.keyboard.press('Escape').catch(()=>{});
    await desk.waitForTimeout(300);
    await block.click();
    await desk.waitForTimeout(500);
    await desk.screenshot({ path: `${OUT}/91-visitor-reopened.png` });
    const visitorBlock = dialog.getByText('Посетитель', { exact: false });
    console.log('visitor block after reopen count:', await visitorBlock.count());
  }
  await desk.close();
} finally {
  await browser.close();
  release();
}
