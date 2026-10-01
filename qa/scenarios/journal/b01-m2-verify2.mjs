import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/shots/journal/b01-m2';
const results = {};
const browser = await chromium.launch();

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
}
async function hideFab(page) {
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
}

// ---- Desktop: resize duration actually changes + no leak, precise before/after ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await hideFab(page);
  await page.waitForTimeout(500);

  try {
    const block = page.locator('[data-f="F-01-026 F-01-027 F-01-214 F-01-031"]').filter({ visible: true }).first();
    const timeLabel = block.locator('span').first();
    const before = await timeLabel.innerText();
    const box = await block.boundingBox();
    const handleX = box.x + box.width / 2;
    const handleY = box.y + box.height - 1;
    await page.mouse.move(handleX, handleY);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(handleX, handleY + i * 10, { steps: 2 });
    }
    await page.mouse.up();
    await page.waitForTimeout(600);
    const after = await timeLabel.innerText();
    const modalOpen = await page.getByRole('heading', { name: 'Запись' }).count().catch(() => 0);
    await shot(page, '30-resize-precise-after');
    results.resizePrecise = { before, after, changed: before !== after, editModalOpenedUnexpectedly: modalOpen };
  } catch (e) {
    results.resizePrecise = `error: ${e}`;
  }
  await ctx.close();
}

// ---- Desktop: week view via <select>, resource view via <select> ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await hideFab(page);
  await page.waitForTimeout(400);
  try {
    const selects = page.locator('select');
    const count = await selects.count();
    const opts = [];
    for (let i = 0; i < count; i++) {
      const optTexts = await selects.nth(i).locator('option').allTextContents();
      opts.push(optTexts);
    }
    results.selects = opts;
    // first select = view mode (День/Неделя)
    await selects.first().selectOption({ label: 'Неделя' });
    await page.waitForTimeout(500);
    await shot(page, '31-week-view');
    results.weekViewOk = true;
    // hours label on top of working day column
    const hoursLabel = await page.locator('text=/\\d{2}:\\d{2}\\s*—\\s*\\d{2}:\\d{2}/').count();
    results.weekHoursLabel = hoursLabel;
  } catch (e) {
    results.weekViewOk = `error: ${e}`;
  }

  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await hideFab(page);
  await page.waitForTimeout(400);
  try {
    const selects = page.locator('select');
    // second select = "По должностям"/"Ресурсы" grouping
    await selects.nth(1).selectOption({ label: 'Ресурсы' });
    await page.waitForTimeout(500);
    await shot(page, '32-resource-view');
    const headerTexts = await page.locator('header, [class*="sticky"]').allTextContents().catch(() => []);
    results.resourceViewOk = true;
  } catch (e) {
    results.resourceViewOk = `error: ${e}`;
  }
  await ctx.close();
}

// ---- Mobile: precise status button size via title selector ----
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await hideFab(page);
  await page.waitForTimeout(500);
  try {
    const statusBtn = page.locator('button[title="Статус и оплата"]').first();
    const box = await statusBtn.boundingBox();
    results.mobileStatusButtonPrecise = box;
    await statusBtn.click();
    await page.waitForTimeout(400);
    await shot(page, '33-mobile-hovercard-precise');
    const toastBefore = await page.getByText('Пришёл', { exact: true }).count();
    if (toastBefore) {
      await page.getByText('Пришёл', { exact: true }).first().click();
      await page.waitForTimeout(400);
      const toast = await page.getByText('Статус изменён').count();
      await shot(page, '34-mobile-status-changed-toast');
      const extraModal = await page.getByRole('heading', { name: 'Запись' }).count();
      results.mobileStatusClick = { toastShown: toast, unexpectedEditModal: extraModal };
    }
  } catch (e) {
    results.mobileStatusButtonPrecise = `error: ${e}`;
  }
  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
