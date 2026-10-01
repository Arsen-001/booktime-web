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

// ============ DESKTOP owner ru ============
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await hideFab(page);
  await page.waitForTimeout(500);

  // F-01-031 fix re-check: resize should NOT open extra "Новая запись" window
  try {
    const block = page.locator('[data-f="F-01-026 F-01-027 F-01-214 F-01-031"]').filter({ visible: true }).first();
    const box = await block.boundingBox();
    const handleX = box.x + box.width / 2;
    const handleY = box.y + box.height - 2;
    await page.mouse.move(handleX, handleY);
    await page.mouse.down();
    await page.mouse.move(handleX, handleY + 60, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    const newBookingOpen = await page.getByText('Новая запись', { exact: false }).count().catch(() => 0);
    await shot(page, '20-resize-after-release');
    results.resizeNoLeak = { newBookingTextCount: newBookingOpen };
  } catch (e) {
    results.resizeNoLeak = `error: ${e}`;
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await hideFab(page);
  await page.waitForTimeout(400);

  // F-01-014 re-check: filter labels + actual filtering works, labels match spec wording
  try {
    await page.getByRole('button', { name: 'Статусы' }).click();
    await page.waitForTimeout(200);
    const labels = await page.locator('label, [role="checkbox"]').allTextContents();
    await shot(page, '21-status-labels');
    results.statusLabels = labels.filter((l) => l.trim());
  } catch (e) {
    results.statusLabels = `error: ${e}`;
  }
  await page.keyboard.press('Escape').catch(() => {});

  // F-01-078: statuses table - check hovercards for different bookings for icon/color match
  try {
    const hoverIcons = await page.locator('[data-f="F-01-026 F-01-027 F-01-214 F-01-031"]').filter({ visible: true }).count();
    results.bookingBlocksVisible = hoverIcons;
    await shot(page, '22-day-grid-blocks');
  } catch (e) {
    results.bookingBlocksVisible = `error: ${e}`;
  }

  // F-01-023: now-line presence
  try {
    const nowLine = await page.locator('text=/^\\d{1,2}:\\d{2}$/').count();
    const hasLineEl = await page.evaluate(() => {
      // find element with a border-top or similar that's absolutely positioned representing now-line
      return !!document.querySelector('[class*="now"], [data-now-line]');
    });
    await shot(page, '23-now-line');
    results.nowLine = { timeLabelMatches: nowLine, domHint: hasLineEl };
  } catch (e) {
    results.nowLine = `error: ${e}`;
  }

  // F-01-013: switch to week view, check now-line still there + hours labels
  try {
    await page.getByRole('combobox').first().click().catch(() => {});
    await page.waitForTimeout(200);
    const weekOption = page.getByText('Неделя', { exact: true });
    if (await weekOption.count()) {
      await weekOption.first().click();
      await page.waitForTimeout(500);
      await shot(page, '24-week-view');
      results.weekView = 'ok';
    } else {
      results.weekView = 'week option not found';
    }
  } catch (e) {
    results.weekView = `error: ${e}`;
  }
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await hideFab(page);
  await page.waitForTimeout(400);

  // F-01-022: resource view - switch "День ▾" dropdown to "Ресурсы"
  try {
    const dayDropdown = page.getByRole('combobox').first();
    await dayDropdown.selectOption({ label: 'Ресурсы' }).catch(async () => {
      await dayDropdown.click();
      await page.getByText('Ресурсы', { exact: true }).click();
    });
    await page.waitForTimeout(500);
    await shot(page, '25-resource-view');
    const cols = await page.locator('text=/#\\d/').allTextContents().catch(() => []);
    results.resourceView = { instanceLabels: cols };
  } catch (e) {
    results.resourceView = `error: ${e}`;
  }
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await hideFab(page);
  await page.waitForTimeout(400);

  // F-01-024 + F-01-215: click occupied cell -> should not silently overwrite; click free cell -> opens window with correct staff/time
  try {
    const grid = page.locator('[data-f="F-01-018 F-01-019 F-01-022 F-01-023 F-01-024 F-01-034 F-01-215"]').first();
    const box = await grid.boundingBox();
    // click far bottom area assumed free (late hour)
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.85);
    await page.waitForTimeout(400);
    const opened = await page.getByText('Новая запись', { exact: false }).count();
    await shot(page, '26-click-empty-cell');
    results.clickEmptyCell = { openedNewBookingCount: opened };
    await page.keyboard.press('Escape').catch(() => {});
  } catch (e) {
    results.clickEmptyCell = `error: ${e}`;
  }

  // F-01-215: try to create booking overlapping an existing one (click occupied block area indirectly via same time on another attempt not simple) -
  // Instead: open new booking window, force same staff/time as existing booking via manual time fields, expect rejection toast.
  try {
    await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
    await hideFab(page);
    await page.waitForTimeout(400);
    const block = page.locator('[data-f="F-01-026 F-01-027 F-01-214 F-01-031"]').filter({ visible: true }).first();
    const box = await block.boundingBox();
    // click directly on existing booking block area but slightly offset to hit grid cell under a DIFFERENT time within same block's column, same time slot as block start -> instead click on the block itself to open EDIT (not create)
    await page.mouse.click(box.x + box.width / 2, box.y + 5);
    await page.waitForTimeout(400);
    await shot(page, '27-click-on-existing-block');
    const editTitle = await page.getByText('Запись', { exact: true }).count();
    results.clickOnExistingBlockOpensEdit = { editTitleCount: editTitle };
    await page.keyboard.press('Escape').catch(() => {});
  } catch (e) {
    results.clickOnExistingBlockOpensEdit = `error: ${e}`;
  }

  await ctx.close();
}

// ============ PHONE owner ru: mobile status button size + sheet ============
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await hideFab(page);
  await page.waitForTimeout(500);

  try {
    const statusBtn = page.locator('[data-f="F-01-029 F-01-078 F-01-214"]').first();
    // status icon button is inside the booking block, small circular button - find button element
    const btn = page.locator('[data-f="F-01-026 F-01-027 F-01-214 F-01-031"] button').first();
    const box = await btn.boundingBox();
    results.mobileStatusButtonSize = box ? { width: box.width, height: box.height } : 'not found';
    await shot(page, '28-mobile-status-button');
  } catch (e) {
    results.mobileStatusButtonSize = `error: ${e}`;
  }

  // F-01-029 hovercard opens by tap on phone, and F-01-214 category badge check inside it
  try {
    const btn = page.locator('[data-f="F-01-026 F-01-027 F-01-214 F-01-031"] button').first();
    await btn.click();
    await page.waitForTimeout(400);
    await shot(page, '29-mobile-hovercard');
    const categoryBadge = await page.locator('text=/VIP|Лояльный|Постоянный/').count();
    results.mobileCategoryBadge = categoryBadge;
  } catch (e) {
    results.mobileCategoryBadge = `error: ${e}`;
  }

  await ctx.close();
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
