import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import path from 'node:path';
const BASE = 'http://localhost:3710';
const OUT = path.resolve('qa/shots/journal/b05-m2');

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/biz/journal/settings?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('text=/Права доступа/').first().scrollIntoViewIfNeeded();
  // выбрать сотрудника "Ани Саргсян" (мастер) через комбобокс
  const staffSelect = page.locator('text=Права доступа').locator('xpath=following::button[1]');
  await staffSelect.click();
  await page.waitForTimeout(300);
  const aniOption = page.locator('text=/Ани Саргсян/').last();
  await aniOption.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'drag1-ani-selected.png') });

  // выключить "Перенос записи (перетаскивание в сетке)"
  const rescheduleLabel = page.getByText('Перенос записи (перетаскивание в сетке)', { exact: true }).first();
  await rescheduleLabel.scrollIntoViewIfNeeded();
  const labelForAttr = await rescheduleLabel.getAttribute('id');
  console.log('label id:', labelForAttr);
  const rescheduleSwitch = page.locator(`button[role="switch"][aria-labelledby="${labelForAttr}"]`).first();
  const swCount = await rescheduleSwitch.count();
  console.log('switch by aria-labelledby count:', swCount);
  const before = await rescheduleSwitch.getAttribute('aria-checked');
  console.log('reschedule switch before:', before);
  if (before !== 'false') {
    await rescheduleSwitch.click();
    await page.waitForTimeout(300);
  }
  const after = await rescheduleSwitch.getAttribute('aria-checked');
  console.log('reschedule switch after:', after);
  await page.screenshot({ path: path.join(OUT, 'drag2-reschedule-off.png') });

  const saveBtn = page.locator('button:has-text("Сохранить")').last();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, 'drag3-saved.png') });

  // сейчас как мастер: открыть журнал, попробовать перетащить запись Ани
  await page.goto(`${BASE}/biz/journal?demo=master&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const firstBooking = page.locator('[data-f*="F-01-024"]').first();
  const bookingCount = await firstBooking.count();
  console.log('bookings found for master view:', bookingCount);
  if (bookingCount) {
    const box = await firstBooking.boundingBox();
    await page.screenshot({ path: path.join(OUT, 'drag4-master-journal-before.png') });
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, { steps: 10 });
      await page.waitForTimeout(200);
      const cursor = await firstBooking.evaluate((el) => getComputedStyle(el).cursor);
      console.log('cursor during drag attempt:', cursor);
      await page.mouse.up();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, 'drag5-master-journal-after.png') });
    }
  }

  await ctx.close();
} finally {
  await browser.close();
  release();
}
