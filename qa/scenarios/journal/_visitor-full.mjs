import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&new=1&staff=st_nuri_ani&start=15:00&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('button', { hasText: /^Маникюр классический/ }).click();
  await page.waitForTimeout(500);

  const phone = page.locator('input[placeholder="91 234 567"]');
  await phone.scrollIntoViewIfNeeded();
  await phone.click();
  await phone.fill('77003344');
  await page.waitForTimeout(200);
  const nameInput = page.locator('input[placeholder="Имя"]').first();
  await nameInput.fill('Мульти Тест');
  await page.waitForTimeout(300);

  await page.getByText('Записывает другого посетителя').click();
  await page.waitForTimeout(300);
  const visitorInput = page.locator('input[placeholder="Введите имя посетителя"]');
  await visitorInput.scrollIntoViewIfNeeded();
  await visitorInput.fill('Малыш Тестов');
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: 'Записать' }).click();
  await page.waitForSelector('text=Записывает другого посетителя', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);

  // reload same day, no ?new= param
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/f_grid-block-label.png' });
  const block = page.locator('[data-testid="booking-block"]').first();
  await block.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/f_block-in-grid.png' });
  await block.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/f_reopened.png' });
  await page.getByRole('tab', { name: 'Клиент', exact: true }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/f_client-tab.png' });

  // History tile check: go back to Запись tab, open history
  await page.getByRole('tab', { name: 'Запись', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByText('История изменений').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/f_history.png' });

  // now edit status to trigger a second history entry, then re-check history
  await page.getByRole('button', { name: 'Пришёл' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Сохранить изменения' }).click().catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/f_after_status_change.png' });
} finally {
  await browser.close();
  release();
}
