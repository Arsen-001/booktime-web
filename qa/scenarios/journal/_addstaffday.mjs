import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&date=2026-12-20', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'qa/shots/journal/b04-header/addstaff_before.png' });
  await page.getByText('Добавить сотрудника').click();
  await page.waitForTimeout(500);
  await page.getByRole('dialog').getByText('Нарине Акопян').click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/shots/journal/b04-header/addstaff_after.png' });
} finally {
  await browser.close();
  release();
}
