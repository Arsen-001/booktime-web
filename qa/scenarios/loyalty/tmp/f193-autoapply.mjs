import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&new=1&staff=st_nuri_ani&start=20:00&date=2026-11-05', { waitUntil: 'networkidle' });
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
  await page.getByRole('button', { name: 'Записать' }).click();
  await page.waitForTimeout(1500);

  const block = page.locator('[data-testid="booking-block"]').filter({ hasText: 'Нелли' }).last();
  await block.scrollIntoViewIfNeeded();
  await block.click({ force: true });
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: 'Лояльность', exact: true }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193-autoapply-1.png', fullPage: true });
  let t = await page.locator('body').innerText();
  let i = t.indexOf('ЛОЯЛЬНОСТЬ');
  console.log('---AFTER OPEN LOYALTY TAB---');
  console.log(t.slice(i, i+700));

  // remove auto-applied line ("Не списывать")
  const removeBtn = page.getByRole('button', { name: 'Не списывать' });
  console.log('DONT-CHARGE btn count', await removeBtn.count());
  if (await removeBtn.count()) {
    await removeBtn.first().click();
    await page.waitForTimeout(600);
    t = await page.locator('body').innerText();
    i = t.indexOf('ЛОЯЛЬНОСТЬ');
    console.log('---AFTER REMOVE---');
    console.log(t.slice(i, i+700));
  }
  console.log('ERRORS', JSON.stringify(errors));
} finally { await browser.close(); release(); }
