import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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
  await visitorInput.fill('Гость Три');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Записать' }).click();
  await page.waitForSelector('text=Записывает другого посетителя', { state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const block = page.locator('[data-testid="booking-block"]').filter({ hasText: 'Гость Три' });
  await block.first().scrollIntoViewIfNeeded();
  await block.first().click({ force: true });
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: 'Оплата', exact: true }).click();
  await page.waitForTimeout(2500);
  const dialog = page.locator('[role="dialog"]').last();
  await dialog.locator('div').filter({hasText:'Личный счёт'}).first().scrollIntoViewIfNeeded().catch(()=>{});
  // scroll the quick-pay list container to bottom
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193f-payment-scroll.png' });
  const modal = page.locator('div').filter({hasText:'Оплата'}).last();
  await page.evaluate(() => {
    const els = document.querySelectorAll('div');
    for (const e of els) { if (e.scrollHeight > e.clientHeight + 50 && e.getBoundingClientRect().top > 200) { e.scrollTop = e.scrollHeight; } }
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/measure/loyalty/g2-2-shots/f193f-payment-scroll2.png', fullPage: true });
  const t = await page.locator('body').innerText();
  console.log(t.slice(t.indexOf('Быстрая оплата'), t.indexOf('Быстрая оплата')+1400));
} finally { await browser.close(); release(); }
