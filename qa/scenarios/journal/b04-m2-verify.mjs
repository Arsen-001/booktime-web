import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const OUT = 'qa/shots/journal-b04-m2/verify';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log('[m2]', ...a);

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
}

try {
  // ── Desktop context: F-01-096, F-01-098, F-01-122, F-01-130-136, F-01-163, F-01-181 ──
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desk.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await desk.waitForTimeout(1000);

  // F-01-096: create a brand-new booking and check history "Создание" line has full snapshot
  await desk.locator('[data-f~="F-01-024"], [data-f="F-01-024"]').first().click({ trial: true }).catch(() => {});
  // fallback: click an empty grid cell
  const grid = desk.locator('[data-testid="journal-grid"], [data-f="F-01-019"]').first();
  await grid.click({ position: { x: 250, y: 300 } }).catch(async () => {
    await desk.mouse.click(400, 400);
  });
  await desk.waitForTimeout(600);
  let dialog = desk.getByRole('dialog');
  if (await dialog.count()) {
    await shot(desk, '01-new-booking-opened');
    // fill client phone/name quickly if fields exist
    const phone = dialog.locator('input[name="phone"], input[placeholder*="елефон" i]').first();
    if (await phone.count()) await phone.fill('077000001').catch(() => {});
    const nameInput = dialog.locator('input[name="clientName"], input[placeholder*="мя" i]').first();
    if (await nameInput.count()) await nameInput.fill('QA История Тест').catch(() => {});
    const saveBtn = dialog.getByRole('button', { name: /Сохранить|Создать/ }).first();
    if (await saveBtn.count()) {
      await saveBtn.click().catch(() => {});
      await desk.waitForTimeout(1000);
    }
    await shot(desk, '02-new-booking-saved');
    dialog = desk.getByRole('dialog');
    if (await dialog.count()) {
      const historyTile = dialog.getByText('История изменений').first();
      if (await historyTile.count()) {
        await historyTile.click();
        await desk.waitForTimeout(400);
        await shot(desk, '03-history-tile-new-booking');
      }
      // F-01-098: check "Источник" tab content
      const sourceTab = dialog.getByRole('tab', { name: /Источник/ }).first();
      if (await sourceTab.count()) {
        await sourceTab.click();
        await desk.waitForTimeout(300);
        await shot(desk, '04-source-tab');
      }
      await desk.keyboard.press('Escape').catch(() => {});
    }
  } else {
    log('F-01-096/098: не открылось окно новой записи кликом по сетке');
    await shot(desk, '01-new-booking-FAILED');
  }
  await desk.waitForTimeout(400);

  // F-01-163: client panel "Create record" button
  const clientsPanelBtn = desk.locator('button[aria-label*="Клиент" i], [data-f="F-01-017"] button').first();
  if (await clientsPanelBtn.count()) {
    await clientsPanelBtn.click().catch(() => {});
    await desk.waitForTimeout(500);
    const search = desk.locator('input[placeholder*="имени или телефону" i]').first();
    if (await search.count()) {
      await search.fill('98');
      await desk.waitForTimeout(500);
      await shot(desk, '05-clients-panel-search');
      const firstClient = desk.locator('[data-testid="client-search-result"], [role="option"]').first();
      if (await firstClient.count()) {
        await firstClient.click().catch(() => {});
        await desk.waitForTimeout(500);
        await shot(desk, '06-client-detail');
        const createBtn = desk.getByRole('button', { name: /Создать запись/ });
        log('F-01-163 "Создать запись" button count:', await createBtn.count());
        const scheduleBtn = desk.getByRole('button', { name: /Расписание специалиста/ });
        log('F-01-163 "Расписание специалиста" button count:', await scheduleBtn.count());
      }
    }
  } else {
    log('F-01-163/F-01-017: кнопка правой панели не найдена на десктопе');
  }

  // F-01-130/131: open an existing booking, add second service, check duration/total change
  await desk.keyboard.press('Escape').catch(() => {});
  await desk.waitForTimeout(300);
  const block = desk.locator('[data-testid="booking-block"]').first();
  if (await block.count()) {
    await block.click();
    await desk.waitForTimeout(600);
    dialog = desk.getByRole('dialog');
    await shot(desk, '07-existing-booking-open');
    const addServiceBtn = dialog.getByRole('button', { name: /Добавить услугу|\+ услуга/i }).first();
    log('F-01-130 add-service button count:', await addServiceBtn.count());
    if (await addServiceBtn.count()) {
      await addServiceBtn.click().catch(() => {});
      await desk.waitForTimeout(400);
      await shot(desk, '08-add-service-menu');
    }
  } else {
    log('F-01-130: не нашёл booking-block на сетке для клика');
  }
  await desk.keyboard.press('Escape').catch(() => {});

  await desk.close();

  // ── Records report: F-01-122, F-01-181, F-01-182, F-01-183 ──
  const rec = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await rec.goto('http://localhost:3710/biz/records?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await rec.waitForTimeout(1000);
  await shot(rec, '10-records-list');
  // widen check: pencil icon reachable without horizontal scroll?
  const pencil = rec.locator('button[aria-label*="Изменить" i], [data-testid="edit-record"]').first();
  log('F-01-181 pencil icon count (no-scroll):', await pencil.count());
  // select row checkbox and try bulk delete
  const rowCheckbox = rec.locator('table input[type="checkbox"]').nth(1);
  if (await rowCheckbox.count()) {
    await rowCheckbox.check().catch(() => {});
    await rec.waitForTimeout(300);
    await shot(rec, '11-row-selected');
    const delBtn = rec.getByRole('button', { name: /Удалить выбранные/ }).first();
    if (await delBtn.count()) {
      await delBtn.click().catch(() => {});
      await rec.waitForTimeout(500);
      await shot(rec, '12-after-bulk-delete');
    }
  }
  const excelMenu = rec.getByRole('button', { name: /Операции с Excel/ }).first();
  if (await excelMenu.count()) {
    await excelMenu.click();
    await rec.waitForTimeout(300);
    await shot(rec, '13-excel-menu');
  }
  await rec.close();

  // ── Phone: F-01-010/011/016/017/152 reachability ──
  const phoneCtx = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await phoneCtx.goto('http://localhost:3710/biz/journal?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await phoneCtx.waitForTimeout(1000);
  await shot(phoneCtx, '20-phone-journal');
  for (const f of ['F-01-010', 'F-01-011', 'F-01-016', 'F-01-017', 'F-01-152']) {
    const el = phoneCtx.locator(`[data-f~="${f}"]`).first();
    const cnt = await el.count();
    log(`phone ${f} present:`, cnt);
  }
  // try opening the "more" menu if it exists
  const moreBtn = phoneCtx.locator('button[aria-label*="ещё" i], button[aria-label*="меню" i]').first();
  if (await moreBtn.count()) {
    await moreBtn.click().catch(() => {});
    await phoneCtx.waitForTimeout(400);
    await shot(phoneCtx, '21-phone-more-menu');
  }
  await phoneCtx.close();
} catch (e) {
  console.error('SCRIPT ERROR', e);
} finally {
  await browser.close();
  release();
}
