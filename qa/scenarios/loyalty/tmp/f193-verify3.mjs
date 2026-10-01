import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&new=1&staff=st_nuri_ani&start=19:00&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('button', { hasText: /^Маникюр классический/ }).click();
  await page.waitForTimeout(500);
  const phone = page.locator('input[placeholder="91 234 567"]');
  await phone.scrollIntoViewIfNeeded();
  await phone.click();
  await phone.fill('95965289');
  await page.waitForTimeout(700);
  await page.getByText('Нелли Симонян').first().click();
  await page.waitForTimeout(400);
  await page.getByText('Записывает другого посетителя').click();
  await page.waitForTimeout(300);
  await page.locator('input[placeholder="Введите имя посетителя"]').fill('Гость Оплатить Кнопка');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Записать' }).click();
  await page.waitForSelector('text=Записывает другого посетителя', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const block = page.locator('[data-testid="booking-block"]').filter({ hasText: 'Гость Оплатить Кнопка' });
  await block.first().scrollIntoViewIfNeeded();
  await block.first().click({ force: true });
  await page.waitForTimeout(800);
  // click the "Оплатить" BUTTON (not the finance tab) inside record tab
  const payBtn = page.getByRole('button', { name: 'Оплатить', exact: true });
  console.log('PAY BUTTON count', await payBtn.count());
  if (await payBtn.count()) {
    await payBtn.first().click();
    await page.waitForTimeout(1200);
    const t = await page.locator('body').innerText();
    const i = t.indexOf('Оплата визита') >= 0 ? t.indexOf('Оплата визита') : 0;
    console.log(t.slice(i, i+1200));
    await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193-verify-paybutton.png', fullPage: true });
  }
} finally { await browser.close(); release(); }
