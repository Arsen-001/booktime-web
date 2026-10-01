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
  await phone.fill('91427186');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193b-1-suggest.png' });
  const sug = page.getByText('Лилит Тадевосян');
  if (await sug.count()>0) { await sug.first().click(); }
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193b-2-picked.png' });

  await page.getByText('Записывает другого посетителя').click();
  await page.waitForTimeout(300);
  const visitorInput = page.locator('input[placeholder="Введите имя посетителя"]');
  await visitorInput.scrollIntoViewIfNeeded();
  await visitorInput.fill('Гость Тестов');
  await page.waitForTimeout(300);

  // go to Оплата tab BEFORE saving to inspect tiles for visitor booking (draft)
  await page.getByRole('tab', { name: 'Оплата', exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193b-3-payment-tab-draft.png', fullPage: true });
  const draftText = await page.locator('body').innerText();
  console.log('DRAFT_HAS_TILES', /Акция|Абонемент|Сертификат|Карта лояльности/.test(draftText));

  await page.getByRole('tab', { name: 'Запись', exact: true }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Записать' }).click();
  await page.waitForSelector('text=Записывает другого посетителя', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193b-4-after-save.png' });

  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&date=2026-11-05', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193b-5-grid.png' });
  const block = page.locator('[data-testid="booking-block"]').filter({ hasText: 'Гость' });
  const bc = await block.count();
  console.log('BLOCK_COUNT', bc);
  if (bc>0) {
    await block.first().scrollIntoViewIfNeeded();
    await block.first().click({ force: true });
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193b-6-reopened.png' });
    await page.getByRole('tab', { name: 'Оплата', exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193b-7-payment-saved.png', fullPage: true });
    const savedText = await page.locator('body').innerText();
    console.log('SAVED_HAS_TILES', /Акция|Абонемент|Сертификат|Карта лояльности/.test(savedText));
    await page.getByRole('tab', { name: 'Лояльность', exact: true }).click().catch(()=>{});
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193b-8-loyalty-tab.png', fullPage: true });
  }
  console.log('ERRORS', JSON.stringify(errors));
} finally { await browser.close(); release(); }
