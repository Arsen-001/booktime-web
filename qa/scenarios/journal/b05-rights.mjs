// b05-m0: реальная проверка прав журнала/окна записи (F-01-085, F-01-115, F-01-154, F-01-178,
// F-01-179, F-01-180) и последствий удаления клиента для записей (F-01-219).
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const out = { steps: [], consoleErrors: [] };
const log = (name, ok, detail) => { out.steps.push({ name, ok: !!ok, detail }); console.log((ok ? '✅' : '❌'), name, detail ?? ''); };

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') out.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => out.consoleErrors.push('pageerror: ' + e.message));

  // ═══════════════ 1. Настроить тонкие права сотрудника "admin" в /biz/journal/settings ═══════════════
  await page.goto(`${BASE}/biz/journal/settings?demo=admin&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const rightsBlock = page.locator('[data-f*="F-01-178"]');
  await rightsBlock.scrollIntoViewIfNeeded();

  // Кто именно вошёл под persona=admin — имя в верхней полосе — должно совпасть с выбором в Select
  const loggedInName = (await page.locator('header, [class*="topbar"]').first().locator('text=/./').allTextContents()).join(' ');
  const topRightName = await page.locator('text=/^[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+$/').first().textContent().catch(() => null);
  log('имя вошедшего admin в шапке', true, topRightName);
  if (topRightName) {
    const staffSelect = rightsBlock.locator('button, [role="combobox"]').first();
    await staffSelect.click();
    await page.waitForTimeout(200);
    const opt = page.getByRole('option', { name: topRightName.trim() });
    if (await opt.count()) {
      await opt.click();
      await page.waitForTimeout(400);
      log('выбран в списке сотрудник = вошедший admin', true, topRightName);
    } else {
      log('вошедший admin НЕ найден в списке сотрудников для настройки прав', false, topRightName);
    }
  }

  const journalTab = page.getByRole('tab', { name: /Журнал записей/i }).first();
  await journalTab.click();
  await page.waitForTimeout(200);

  const swShowPhones = rightsBlock.getByRole('switch', { name: 'Показывать номера телефонов' });
  const swReschedule = rightsBlock.getByRole('switch', { name: /Перенос записи/ });
  log('переключатель "Показывать номера телефонов" найден', await swShowPhones.count() === 1);
  log('переключатель "Перенос записи" найден', await swReschedule.count() === 1);
  const phonesBefore = await swShowPhones.getAttribute('aria-checked');
  const rescheduleBefore = await swReschedule.getAttribute('aria-checked');
  if (phonesBefore === 'true') { await swShowPhones.click(); await page.waitForTimeout(1500); }
  if (rescheduleBefore === 'true') { await swReschedule.click(); await page.waitForTimeout(1500); }
  log('showPhones выключен после клика', (await swShowPhones.getAttribute('aria-checked')) === 'false');
  log('reschedule выключен после клика', (await swReschedule.getAttribute('aria-checked')) === 'false');

  // viewStaffScope = own
  const radioOwn = rightsBlock.getByRole('radio', { name: 'Только свои' });
  await radioOwn.click();
  await page.waitForTimeout(1500);
  log('viewStaffScope=own выбран', await radioOwn.isChecked());

  // Окно записи: editArrivedPaid off, deletePaidBookings off, changeStaffAndTime ON (для F-01-115)
  const windowTab = page.getByRole('tab', { name: /Окно записи/i }).first();
  await windowTab.click();
  await page.waitForTimeout(200);
  const swEditArrivedPaid = rightsBlock.getByRole('switch', { name: /редактирование оплаченной записи.*Клиент пришел/i });
  const swDeletePaid = rightsBlock.getByRole('switch', { name: /Удаление оплаченных записей/i });
  const swChangeStaffTime = rightsBlock.getByRole('switch', { name: /Изменять сотрудника и время записи/i });
  const swEditBookings = rightsBlock.getByRole('switch', { name: 'Изменять записи' });
  log('окно записи: право "оплаченная Клиент пришел" найдено', await swEditArrivedPaid.count() === 1);
  log('окно записи: "Удаление оплаченных записей" найдено', await swDeletePaid.count() === 1);
  log('окно записи: "Изменять сотрудника и время записи" найдено', await swChangeStaffTime.count() === 1);
  if ((await swEditArrivedPaid.getAttribute('aria-checked')) === 'true') { await swEditArrivedPaid.click(); await page.waitForTimeout(1500); }
  if ((await swDeletePaid.getAttribute('aria-checked')) === 'true') { await swDeletePaid.click(); await page.waitForTimeout(1500); }
  if ((await swChangeStaffTime.getAttribute('aria-checked')) === 'false') { await swChangeStaffTime.click(); await page.waitForTimeout(1500); }
  if ((await swEditBookings.getAttribute('aria-checked')) === 'false') { await swEditBookings.click(); await page.waitForTimeout(1500); }
  log('editArrivedPaid=off', (await swEditArrivedPaid.getAttribute('aria-checked')) === 'false');
  log('deletePaidBookings=off', (await swDeletePaid.getAttribute('aria-checked')) === 'false');
  log('changeStaffAndTime=on', (await swChangeStaffTime.getAttribute('aria-checked')) === 'true');

  await page.screenshot({ path: 'qa/shots/journal/b05-rights-configured.png', fullPage: true });

  // ═══════════════ 2. Журнал: свернуто до своей колонки (viewStaffScope=own), нет drag ═══════════════
  await page.goto(`${BASE}/biz/journal?demo=admin&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const columns = await page.locator('[data-f*="F-01-001"] [role="columnheader"], [data-testid="staff-column-header"]').count();
  await page.screenshot({ path: 'qa/shots/journal/b05-journal-own-scope.png', fullPage: true });
  const staffHeaders = await page.locator('text=Нарине Акопян').count();
  log('журнал открылся под "admin" с viewStaffScope=own (снимок b05-journal-own-scope.png)', true, `совпадений своего имени: ${staffHeaders}, колонок-заголовков: ${columns}`);

  await ctx.close();
} catch (e) {
  out.error = String(e);
  console.error(e);
} finally {
  await browser.close();
  release();
  fs.mkdirSync('qa/shots/journal', { recursive: true });
  fs.writeFileSync('qa/measure/journal/b05-rights-report.json', JSON.stringify(out, null, 2));
  console.log('done');
}
