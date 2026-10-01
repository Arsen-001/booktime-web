import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&new=1&staff=st_nuri_ani&start=16:00&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('button', { hasText: /^Маникюр классический/ }).click();
  await page.waitForTimeout(500);

  const phone = page.locator('input[placeholder="91 234 567"]');
  await phone.scrollIntoViewIfNeeded();
  await phone.click();
  await phone.fill('95965289');
  await page.waitForTimeout(700);
  const sug = page.getByText('Нелли Симонян');
  console.log('sug count', await sug.count());
  if (await sug.count()>0) { await sug.first().click(); }
  await page.waitForTimeout(400);

  await page.getByText('Записывает другого посетителя').click();
  await page.waitForTimeout(300);
  const visitorInput = page.locator('input[placeholder="Введите имя посетителя"]');
  await visitorInput.scrollIntoViewIfNeeded();
  await visitorInput.fill('Гость Нелли');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193c-1-form.png', fullPage: true });

  await page.getByRole('button', { name: 'Записать' }).click();
  await page.waitForSelector('text=Записывает другого посетителя', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);

  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const block = page.locator('[data-testid="booking-block"]').filter({ hasText: 'Гость Нелли' });
  console.log('BLOCK_COUNT', await block.count());
  await block.first().scrollIntoViewIfNeeded();
  await block.first().click({ force: true });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193c-2-reopened.png' });
  await page.getByRole('tab', { name: 'Оплата', exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193c-3-payment.png', fullPage: true });
  const savedText = await page.locator('body').innerText();
  console.log('HAS_CARD_TILE', savedText.includes('Карта') || savedText.includes('лояльности') || savedText.includes('Акция') || savedText.includes('Скидка'));
  console.log('ERRORS', JSON.stringify(errors));
} finally { await browser.close(); release(); }
