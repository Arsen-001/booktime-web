import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&new=1&staff=st_nuri_ani&start=15:00&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('button', { hasText: /^Маникюр классический/ }).click();
  await page.waitForTimeout(500);

  const phone = page.locator('input[placeholder="91 234 567"]');
  await phone.scrollIntoViewIfNeeded();
  await phone.click();
  await phone.fill('91');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193-1-suggest.png' });
  const suggestions = page.locator('[role="option"], [data-suggestion], li').filter({ hasText: '+374' });
  const n = await suggestions.count();
  console.log('suggestions', n);
  if (n > 0) {
    await suggestions.first().click();
  } else {
    await phone.fill('91234567');
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193-2-client-picked.png' });

  await page.getByText('Записывает другого посетителя').click();
  await page.waitForTimeout(300);
  const visitorInput = page.locator('input[placeholder="Введите имя посетителя"]');
  await visitorInput.scrollIntoViewIfNeeded();
  await visitorInput.fill('Гость Тестов');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193-3-visitor-filled.png' });

  await page.getByRole('button', { name: 'Записать' }).click();
  await page.waitForSelector('text=Записывает другого посетителя', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);

  // reopen the booking
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const block = page.locator('[data-testid="booking-block"]').last();
  await block.scrollIntoViewIfNeeded();
  await block.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193-4-reopened.png' });

  // find payment section
  const paymentBtn = page.getByRole('button', { name: /Оплатить/ }).first();
  if (await paymentBtn.count() > 0) {
    await paymentBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193-5-payment.png' });
  }
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193-6-full.png', fullPage: true });

  const bodyText = await page.locator('body').innerText();
  console.log('HAS_VISITOR_LABEL', bodyText.includes('Посетитель'));
  console.log('HAS_CLIENT_LABEL', bodyText.includes('Клиент'));
  console.log('HAS_CARD_TILE', /Акция|Абонемент|Сертификат|Карта/.test(bodyText));
  console.log('ERRORS', JSON.stringify(errors));
} finally {
  await browser.close();
  release();
}
