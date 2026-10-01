import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&new=1&staff=st_nuri_ani&start=18:00&date=2026-11-05', { waitUntil: 'networkidle' });
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
  const visitorInput = page.locator('input[placeholder="Введите имя посетителя"]');
  await visitorInput.scrollIntoViewIfNeeded();
  await visitorInput.fill('Гость Нелли Коммит');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Записать' }).click();
  await page.waitForSelector('text=Записывает другого посетителя', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const block = page.locator('[data-testid="booking-block"]').filter({ hasText: 'Гость Нелли Коммит' });
  await block.first().scrollIntoViewIfNeeded();
  await block.first().click({ force: true });
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: 'Лояльность', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByText(/Скидка постоянному гостю/).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Провести оплату лояльностью' }).click();
  await page.waitForTimeout(1500);
  const t1 = await page.locator('body').innerText();
  console.log('---AFTER COMMIT---');
  const i = t1.indexOf('ЛОЯЛЬНОСТЬ');
  console.log(t1.slice(i, i+800));
  console.log('ERRORS', JSON.stringify(errors));

  // now go to client card transactions
  await page.goto('http://localhost:3710/biz/loyalty/transactions?demo=owner&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const t2 = await page.locator('body').innerText();
  console.log('---TRANSACTIONS PAGE (first 1500)---');
  console.log(t2.slice(0, 1500));
} finally { await browser.close(); release(); }
