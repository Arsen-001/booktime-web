import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light&date=2026-11-09', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.getByText('Новая запись').click();
  await page.waitForTimeout(400);
  await page.getByText('Пакет услуг').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/pkg_modal_open.png' });

  // pick different staff for second step (parallel) to force real "package" of 2 staff
  await page.getByText('Параллельно').click().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/pkg_parallel_selected.png' });

  // set second step's staff select to a different staff
  const staffSelects = page.locator('button', { hasText: /Ани Саргсян|Мариам Петросян|Сона Григорян/ });
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/pkg_before_staff_pick.png' });

  await page.fill('input[placeholder="91 234 567"]', '77009911').catch(() => {});
  const nameField = page.locator('input').last();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b04-booking-window/pkg_slots.png' });
} finally {
  await browser.close();
  release();
}
