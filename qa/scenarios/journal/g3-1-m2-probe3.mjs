// Догон 2: F-01-037 плитки в УЖЕ сохранённой записи (переоткрыть после закрытия окна),
// F-01-013 рабочий (не выходной) сотрудник в недельном виде, F-01-029/086 hover-карточка,
// F-01-119/121 удаление и решение "у нас", F-01-181 карандаш из /biz/records.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal-g3-1-m2/probe3';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (id, msg) => { log.push(`${id}: ${msg}`); console.log(id, '::', msg); };
const f = (id) => `[data-f~="${id}"]`;
const shot = async (page, name) => page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  // click first existing record block (already has data)
  const block = page.locator(f('F-01-026')).first();
  await block.click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
  await shot(page, '01-reopened-existing');
  const advanced = await page.locator('text=/Списание расходников|История изменений/i').count();
  note('F-01-037', `у существующей (ранее сохранённой) записи плитки «Списание/История»: ${advanced} найдено`);

  // F-01-029: status hover
  const statusIcon = page.locator(f('F-01-029')).first();
  const statusCount = await statusIcon.count();
  note('F-01-029', `значок статуса data-f найден в открытом окне: ${statusCount}`);
  if (statusCount) {
    await statusIcon.hover().catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '02-hover-status-card');
  }
  // status buttons directly in window (F-01-054 style buttons visible in earlier screenshot: Записан/Пришёл/Не пришёл/Клиент подтвердил...)
  const confirmBtn = page.getByRole('button', { name: /Клиент подтвердил/i }).first();
  note('F-01-086', `кнопка «Клиент подтвердил» есть в окне: ${await confirmBtn.count() > 0}`);
  if (await confirmBtn.count()) {
    await confirmBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, '03-after-confirm-click');
    const toast = await page.locator('text=/Сохранено|статус|Статус/i').count();
    note('F-01-086', `отклик после клика (тост/индикатор): найдено совпадений ${toast}`);
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);

  // F-01-013: pick a real working staff (Ани Саргсян) in week view
  const toggle = page.locator('[role=combobox]').filter({ hasText: /^День/ }).first();
  if (await toggle.count()) {
    await toggle.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('[role="option"]').filter({ hasText: /^Неделя$/ }).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    const staffSel = page.locator('[role=combobox]').nth(1);
    if (await staffSel.count()) {
      await staffSel.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
      const aniOpt = page.locator('[role="option"]').filter({ hasText: /Саргсян/i }).first();
      if (await aniOpt.count()) {
        await aniOpt.click({ force: true }).catch(() => {});
        await page.waitForTimeout(700);
        await shot(page, '04-week-working-staff');
        const workingHoursVisible = await page.locator('text=/08:00|09:00/').count();
        note('F-01-013', `у рабочего сотрудника в недельном виде часы видны: ${workingHoursVisible > 0}`);
        const weekend = await page.locator('text=/Выходной/').count();
        note('F-01-013', `«Выходной» подписи для нерабочих дней: ${weekend}`);
      }
    }
  }

  await ctx.close();

  // ---- F-01-119/121/181: records screen, delete + restore решение ----
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/biz/records?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(800);
  const firstRow = page2.locator('table tbody tr, [role=row]').first();
  note('F-01-181', `первая строка записей найдена: ${await firstRow.count() > 0}`);
  await firstRow.hover().catch(() => {});
  await page2.waitForTimeout(300);
  await shot(page2, '10-row-hover');
  const pencilBtn = firstRow.locator('button[aria-label*="Изменит" i], button[title*="Изменит" i], [data-f~="F-01-181"]');
  note('F-01-181', `кнопка карандаша в строке (по aria-label/title/data-f): ${await pencilBtn.count()}`);
  if (await pencilBtn.count()) {
    await pencilBtn.first().click({ force: true }).catch(() => {});
    await page2.waitForTimeout(600);
    const opened = await page2.locator(f('F-01-037')).count();
    note('F-01-181', `клик карандаша открыл окно записи: ${opened > 0}`);
    await shot(page2, '11-pencil-opened');
  } else {
    await firstRow.click({ force: true }).catch(() => {});
    await page2.waitForTimeout(600);
    const openedByRow = await page2.locator(f('F-01-037')).count();
    note('F-01-181', `клик по СТРОКЕ (не по конкретному карандашу) открыл окно записи: ${openedByRow > 0}`);
    await shot(page2, '11b-row-click-opened');
  }
  await ctx2.close();

  fs.writeFileSync(`${OUT}/log.txt`, log.join('\n'));
  console.log('DONE');
} catch (e) {
  console.log('FATAL', e.message);
  fs.writeFileSync(`${OUT}/log.txt`, log.join('\n') + '\nFATAL: ' + e.message);
} finally {
  await browser.close();
  release();
}
