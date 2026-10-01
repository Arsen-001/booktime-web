import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log('[m2b]', ...a);
async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
}

try {
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desk.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await desk.waitForTimeout(1000);
  const block = desk.locator('[data-testid="booking-block"]').first();
  await block.click();
  await desk.waitForTimeout(600);
  const dialog = desk.getByRole('dialog');
  // list all tab labels
  const tabLabels = await dialog.getByRole('tab').allTextContents().catch(() => []);
  log('booking dialog tabs:', JSON.stringify(tabLabels));
  await shot(desk, '30-booking-tabs');
  // expand history
  const historyRow = dialog.getByText('История изменений', { exact: false }).first();
  if (await historyRow.count()) {
    await historyRow.click();
    await desk.waitForTimeout(400);
    await shot(desk, '31-history-expanded');
    const bodyText = await dialog.innerText();
    log('history block text snippet:', bodyText.slice(0, 30) === '' ? '(empty)' : 'ok');
  }
  // add second service check
  const servicesTab = dialog.getByRole('tab', { name: /Услуги/ }).first();
  if (await servicesTab.count()) {
    await servicesTab.click();
    await desk.waitForTimeout(300);
    await shot(desk, '32-services-tab');
  }
  const addServiceBtn = dialog.getByText(/Добавить услугу/i).first();
  log('add-service text-match count:', await addServiceBtn.count());
  if (await addServiceBtn.count()) {
    const beforeTotal = await dialog.locator('text=/К оплате/').first().innerText().catch(() => '');
    log('total before:', beforeTotal);
    await addServiceBtn.click().catch(() => {});
    await desk.waitForTimeout(500);
    await shot(desk, '33-service-picker');
    const firstOption = desk.locator('[role="option"], [data-testid="service-option"]').first();
    if (await firstOption.count()) {
      await firstOption.click().catch(() => {});
      await desk.waitForTimeout(500);
      await shot(desk, '34-second-service-added');
      const afterTotal = await dialog.locator('text=/К оплате/').first().innerText().catch(() => '');
      log('total after:', afterTotal);
    }
  }
  await desk.keyboard.press('Escape').catch(() => {});
  await desk.close();

  // Records: complete bulk-delete confirm, then check pencil/edit reachability
  const rec = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await rec.goto('http://localhost:3710/biz/records?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await rec.waitForTimeout(1000);
  // find a row NOT already cancelled/paid to test actual deletion visibly; use row 2 (index1 body)
  const rows = rec.locator('table tbody tr');
  const rowCount = await rows.count();
  log('records row count:', rowCount);
  const cb = rows.nth(1).locator('input[type="checkbox"]');
  await cb.check().catch(() => {});
  await rec.waitForTimeout(200);
  const delBtn = rec.getByRole('button', { name: /Удалить выбранные/ }).first();
  await delBtn.click();
  await rec.waitForTimeout(400);
  const confirmDialog = rec.getByRole('dialog');
  await shot(rec, '40-delete-confirm-dialog');
  const confirmBtn = confirmDialog.getByRole('button', { name: /^Удалить$/ }).first();
  if (await confirmBtn.count()) {
    await confirmBtn.click();
    await rec.waitForTimeout(600);
  }
  await shot(rec, '41-after-confirm-delete');

  // pencil / edit reachability: scroll table right
  const tableWrap = rec.locator('table').first();
  const box = await tableWrap.boundingBox();
  log('table width vs viewport 1440:', box?.width);
  const scrollContainer = rec.locator('.overflow-x-auto, [data-testid="records-table-scroll"]').first();
  if (await scrollContainer.count()) {
    await scrollContainer.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
    await rec.waitForTimeout(300);
    await shot(rec, '42-scrolled-right');
  }
  const pencilAfterScroll = rec.locator('button[aria-label*="Изменить" i], [data-testid="edit-record"], button:has(svg)').filter({ hasText: '' });
  log('pencil count after scroll (heuristic):', await rec.locator('table tbody tr').first().locator('button').count());
  await rec.close();

  // Mobile: try more/hamburger for hidden actions
  const phoneCtx = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phoneCtx.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phoneCtx.waitForTimeout(1000);
  await shot(phoneCtx, '50-phone-journal-top');
  const allButtons = await phoneCtx.locator('header button, [role="banner"] button').allTextContents().catch(() => []);
  log('phone header buttons:', JSON.stringify(allButtons));
  await phoneCtx.close();
} catch (e) {
  console.error('SCRIPT ERROR', e);
} finally {
  await browser.close();
  release();
}
