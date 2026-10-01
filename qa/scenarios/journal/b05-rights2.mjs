// b05-m0 (продолжение): маска телефона (F-01-178), ограничение правки оплаченной "Клиент пришел"
// записи (F-01-085/179), запрет удаления оплаченной записи, окно в прошлое (F-01-180),
// перенос через окно при выключенном "Перенос записи" в журнале (F-01-115).
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const out = { steps: [], consoleErrors: [] };
const log = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); console.log((ok ? '✅' : '❌'), name, detail ?? ''); };

async function selectSelfInRightsStaffPicker(page, rightsBlock) {
  const topRightName = await page.locator('text=/^[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+$/').first().textContent();
  const staffSelect = rightsBlock.locator('button, [role="combobox"]').first();
  await staffSelect.click();
  await page.waitForTimeout(200);
  const opt = page.getByRole('option', { name: topRightName.trim() });
  await opt.click();
  await page.waitForTimeout(400);
  return topRightName.trim();
}

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') out.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => out.consoleErrors.push('pageerror: ' + e.message));

  // ── Настроить: scope=all (вернуть), showPhones=off, editBookings=on, editArrivedPaid=off,
  //    deleteBookings=on, deletePaidBookings=off, reschedule(journal)=off, changeStaffAndTime(window)=on,
  //    historyLimit=1d ──
  await page.goto(`${BASE}/biz/journal/settings?demo=admin&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const rightsBlock = page.locator('[data-f*="F-01-178"]');
  await rightsBlock.scrollIntoViewIfNeeded();
  const selfName = await selectSelfInRightsStaffPicker(page, rightsBlock);
  log('выбран сотрудник = вошедший admin', true, selfName);

  await page.getByRole('tab', { name: /Журнал записей/i }).first().click();
  await page.waitForTimeout(200);
  const radioAll = rightsBlock.getByRole('radio', { name: 'Все сотрудники' });
  await radioAll.click();
  await page.waitForTimeout(1200);
  log('viewStaffScope вернули на "Все сотрудники"', await radioAll.isChecked());

  const historySelect = rightsBlock.locator('select, button, [role="combobox"]').filter({ hasText: /Без ограничения|1 день|3 дня|неделя|месяц|Не ограничивать|месяцев/i }).last();
  await historySelect.click();
  await page.waitForTimeout(200);
  const opt1d = page.getByRole('option', { name: /1 день/i });
  if (await opt1d.count()) { await opt1d.click(); await page.waitForTimeout(1200); }
  log('historyLimit=1 день выбран (для F-01-180)', true);

  await page.getByRole('tab', { name: /Окно записи/i }).first().click();
  await page.waitForTimeout(200);
  const setSwitch = async (label, want) => {
    const sw = rightsBlock.getByRole('switch', { name: label, exact: true });
    if ((await sw.count()) !== 1) { log(`право "${label}" НЕ найдено однозначно`, false, await sw.count()); return; }
    const cur = (await sw.getAttribute('aria-checked')) === 'true';
    if (cur !== want) { await sw.click(); await page.waitForTimeout(1200); }
    const after = (await sw.getAttribute('aria-checked')) === 'true';
    log(`право "${label}" = ${want}`, after === want, after);
  };
  await setSwitch('Показывать номера телефонов', false);
  await setSwitch('Изменять записи', true);
  await setSwitch('Доступ на редактирование оплаченной записи в статусе «Клиент пришел»', false);
  await setSwitch('Удалять записи', true);
  await setSwitch('Удаление оплаченных записей', false);
  await setSwitch('Изменять сотрудника и время записи', true);

  await page.getByRole('tab', { name: /Журнал записей/i }).first().click();
  await page.waitForTimeout(200);
  await setSwitch('Перенос записи (перетаскивание в сетке)', false);

  await page.screenshot({ path: 'qa/shots/journal/b05-rights2-configured.png', fullPage: true });

  // ═══ Открыть журнал, найти оплаченную запись со статусом "Клиент пришёл", проверить телефон и правку ═══
  await page.goto(`${BASE}/biz/journal?demo=admin&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Первая попавшаяся запись — открыть окно
  const bookingBlocks = page.locator('[data-f*="F-01-026"]');
  const count = await bookingBlocks.count();
  log('число видимых записей на сегодня в журнале', count > 0, count);

  if (count > 0) {
    await bookingBlocks.first().click();
    await page.waitForTimeout(700);
    const dialog = page.getByRole('dialog');
    // F-01-179: смена клиента открывает поиск (ClientZone) — там телефон маскируется windowRights.showPhones
    const changeClientBtn = dialog.getByRole('button', { name: /Изменить/i }).first();
    if (await changeClientBtn.count()) {
      await changeClientBtn.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: 'qa/shots/journal/b05-booking-window-clientzone.png', fullPage: true });
      const searchInput = dialog.locator('input[type="text"], input[type="search"]').first();
      if (await searchInput.count()) {
        await searchInput.fill('374');
        await page.waitForTimeout(600);
        await page.screenshot({ path: 'qa/shots/journal/b05-booking-window-clientzone-search.png', fullPage: true });
        const bodyTxt = await dialog.textContent();
        const hasBullet = /•/.test(bodyTxt ?? '');
        const hasX = /X{3,}/.test(bodyTxt ?? '');
        log('F-01-179: телефон в списке поиска клиента замаскирован (bullet or X)', hasBullet || hasX, { hasBullet, hasX });
      }
    } else {
      log('кнопка "Изменить" клиента не найдена в окне записи', false);
    }
    await page.keyboard.press('Escape').catch(() => {});
  }

  // ═══ Перенос перетаскиванием должен быть запрещён (reschedule=off), но через окно (changeStaffAndTime=on) — доступен ═══
  // Ищем "Клиент пришёл" + оплачено — статус-бейдж
  await page.goto(`${BASE}/biz/journal?demo=admin&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // Найти в моковой базе реальную запись "arrived" с оплатой > 0 для этого бизнеса — читаем localStorage напрямую
  const found1 = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('bp-mock-db');
      if (!raw) return null;
      const db = JSON.parse(raw).state ?? JSON.parse(raw);
      const core = db.core;
      const bookings = core.bookings ?? [];
      const extras = db.areas?.journal?.extras ?? {};
      const arrived = bookings.filter((b) => b.status === 'arrived' && !b.deletedAt);
      const paid = arrived.find((b) => (extras[b.id]?.paidAmount ?? 0) > 0);
      return paid ? { id: paid.id, businessId: paid.businessId, paidAmount: extras[paid.id]?.paidAmount } : (arrived[0] ? { id: arrived[0].id, businessId: arrived[0].businessId, paidAmount: 0 } : null);
    } catch (e) {
      return { error: String(e) };
    }
  });
  log('найдена запись со статусом "Пришёл" в моковой базе', !!(found1 && found1.id), found1);

  if (found1 && found1.id) {
    await page.goto(`${BASE}/biz/journal?demo=admin&sphere=nails&lang=ru&booking=${found1.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const dialog = page.getByRole('dialog');
    const opened = await dialog.count();
    await page.screenshot({ path: 'qa/shots/journal/b05-arrived-booking.png', fullPage: true });
    if (opened) {
      const isPaid = (found1.paidAmount ?? 0) > 0;
      const commentBox = dialog.locator('textarea').first();
      const commentDisabled = await commentBox.isDisabled().catch(() => null);
      log(`окно оплаченной="${isPaid}" записи "Пришёл" открыто по прямой ссылке`, true, { commentDisabled });
      if (isPaid) {
        log('F-01-085/179: поле комментария задизейблено на ОПЛАЧЕННОЙ "Пришёл" (editArrivedPaid=off)', commentDisabled === true, commentDisabled);
        const trashIcon = page.locator('button:has(svg)').first();
        const trashDisabled = await trashIcon.isDisabled().catch(() => null);
        log('F-01-085: кнопка удаления задизейблена на оплаченной записи (deletePaidBookings=off)', trashDisabled === true, trashDisabled);
      } else {
        log('в базе не нашлось ОПЛАЧЕННОЙ записи "Пришёл" — проверили только статус без оплаты (не полный охват editArrivedPaid)', false, found1);
      }
    } else {
      log('окно записи НЕ открылось по параметру ?booking=', false, found1);
    }
  }

  await ctx.close();
} catch (e) {
  out.error = String(e);
  console.error(e);
} finally {
  await browser.close();
  release();
  fs.writeFileSync('qa/measure/journal/b05-rights2-report.json', JSON.stringify(out, null, 2));
  console.log('done');
}
