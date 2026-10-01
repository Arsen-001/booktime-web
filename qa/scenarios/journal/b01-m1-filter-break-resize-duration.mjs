import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal/b01-m1';

const results = {};

const browser = await chromium.launch();

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

// ---- Desktop context: owner, ru ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
  await page.waitForTimeout(500);

  // F-01-014: filter statuses
  try {
    await page.getByRole('button', { name: 'Статусы' }).click();
    await page.waitForTimeout(200);
    await shot(page, '03-statuses-open');
    // count bookings before
    const before = await page.locator('[data-f="F-01-024"] >> [data-f="F-01-026 F-01-027 F-01-214 F-01-031"]').count().catch(() => -1);
    await page.getByRole('checkbox', { name: 'Подтверждена' }).click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await shot(page, '04-after-filter');
    results.filter = { before, ok: true };
  } catch (e) {
    results.filter = { error: String(e) };
    await shot(page, 'fail-filter');
  }

  // reload to reset
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // F-01-032: break menu click
  try {
    const breakEl = page.locator('[data-f="F-01-032"]').filter({ visible: true }).first();
    await breakEl.click();
    await page.waitForTimeout(300);
    await shot(page, '05-break-menu-open');
    results.breakMenu = 'ok';
  } catch (e) {
    results.breakMenu = `error: ${e}`;
    await shot(page, 'fail-break');
  }
  await page.keyboard.press('Escape');

  // F-01-031: resize by dragging handle
  try {
    const block = page.locator('[data-f="F-01-026 F-01-027 F-01-214 F-01-031"]').filter({ visible: true }).first();
    const box = await block.boundingBox();
    const before = await block.locator('button').first().innerText().catch(() => '');
    // resize handle is at bottom edge, h-2
    const handleX = box.x + box.width / 2;
    const handleY = box.y + box.height - 2;
    await page.mouse.move(handleX, handleY);
    await page.mouse.down();
    await page.mouse.move(handleX, handleY + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    await shot(page, '06-after-resize');
    results.resize = 'ok, see screenshot';
  } catch (e) {
    results.resize = `error: ${e}`;
    await shot(page, 'fail-resize');
  }

  // F-01-018: empty day - try far future date via URL date query? Check if journal accepts ?date=
  try {
    await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&date=2030-01-01`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await shot(page, '07-far-future-date');
    const emptyText = await page.getByText('Расписание не установлено').count().catch(() => 0);
    results.emptyDay = { emptyTextFound: emptyText };
  } catch (e) {
    results.emptyDay = `error: ${e}`;
  }

  // F-01-034: duration limits - open new booking window, set duration to 4 then 5
  try {
    await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Новая запись' }).click();
    await page.waitForTimeout(400);
    await shot(page, '08-new-booking-window');
    const durationInput = page.locator('input[type="number"]').first();
    await durationInput.fill('4');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.waitForTimeout(400);
    await shot(page, '09-duration-4-rejected');
    const toastText4 = await page.locator('text=/длительн/i').count().catch(() => 0);
    await durationInput.fill('5');
    await page.getByRole('button', { name: 'Сохранить' }).click();
    await page.waitForTimeout(500);
    await shot(page, '10-duration-5-result');
    results.durationLimits = { toastOn4: toastText4 };
  } catch (e) {
    results.durationLimits = `error: ${e}`;
    await shot(page, 'fail-duration');
  }

  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
