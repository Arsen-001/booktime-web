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
  await phone.fill('77003399');
  await page.waitForTimeout(200);
  const nameInput = page.locator('input[placeholder="Имя"]').first();
  await nameInput.fill('Родитель Тест');
  await page.waitForTimeout(300);
  await page.getByText('Записывает другого посетителя').click();
  await page.waitForTimeout(300);
  const visitorInput = page.locator('input[placeholder="Введите имя посетителя"]');
  await visitorInput.scrollIntoViewIfNeeded();
  await visitorInput.fill('Ребёнок Тест');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Записать' }).click();
  await page.waitForTimeout(800);
  const confirmBtn = page.getByRole('button', { name: 'Да', exact: true });
  if (await confirmBtn.count()) {
    await confirmBtn.click();
    await page.waitForSelector('text=Вне графика мастера', { state: 'detached', timeout: 8000 }).catch(() => {});
  }
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/h_after_click_zapisat.png' });
  console.log('url after save:', page.url());

  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const block = page.locator('[data-testid="booking-block"]').first();
  await block.click();
  await page.waitForTimeout(700);
  // stay on "Запись" tab (default), scroll internal content down to reach ClientZone/VisitorBlock
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach((el) => {
      if (el.scrollHeight > el.clientHeight + 20) el.scrollTop = el.scrollHeight;
    });
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/h_record_tab_visitor_block.png' });
} finally {
  await browser.close();
  release();
}
