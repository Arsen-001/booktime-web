import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Open an EXISTING seeded booking (no visitor yet) and toggle ONLY the visitor checkbox+name, save, reload.
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const block = page.locator('[data-testid="booking-block"]').first();
  await block.click();
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 20) el.scrollTop = el.scrollHeight;
    });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/i_existing_before_visitor.png' });
  await page.getByText('Записывает другого посетителя').click({ force: true });
  await page.waitForTimeout(300);
  const visitorInput = page.locator('input[placeholder="Введите имя посетителя"]');
  await visitorInput.fill('Только Посетитель');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/i_existing_visitor_filled.png' });
  const saveBtn = page.getByRole('button', { name: 'Сохранить изменения' });
  console.log('save button disabled?', await saveBtn.isDisabled());
  await saveBtn.click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/i_after_save.png' });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('.animate-fade-in').first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.getByText('Зара Давтян').first().click();
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 20) el.scrollTop = el.scrollHeight;
    });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/i_after_reload_reopen.png' });
} finally {
  await browser.close();
  release();
}
