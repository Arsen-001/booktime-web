import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByText('Новая запись').click();
  await page.waitForTimeout(400);
  await page.getByText('Пакет услуг').click();
  await page.waitForTimeout(700);

  // step1 staff -> Ani
  await page.locator('button', { hasText: 'Нарине Акопян' }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/pkg2_dropdown_open.png' });
  await page.locator('text=Ани Саргсян').last().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/pkg2_step1_staff.png' });

  await page.getByText('Параллельно').click();
  await page.waitForTimeout(400);

  // now step2 staff select should be enabled; pick Sona
  const staffSelect2 = page.locator('button', { hasText: 'Нарине Акопян' }).first();
  await staffSelect2.click();
  await page.waitForTimeout(300);
  await page.locator('text=Сона Григорян').last().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/pkg2_parallel_staff2.png' });

  await page.fill('input[placeholder="91 234 567"]', '77008822');
  await page.fill('input#package-client-name, input[type=text] >> nth=-1', '').catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/pkg2_slots.png' });
} finally {
  await browser.close();
  release();
}
