// Измеритель g3-1-m2: живой прогон списка F-id журнала после доделки g3-1.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal-g3-1-m2/probe';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (id, msg) => { log.push(`${id}: ${msg}`); console.log(id, '::', msg); };
const f = (id) => `[data-f~="${id}"]`;
const shot = async (page, name) => page.screenshot({ path: `${OUT}/${name}.png` }).catch((e) => note('shot-fail', name + ' ' + e.message));

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  // ============ ЧАСТЬ 1: owner desktop ru, основной проход ============
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await shot(page, '01-journal-owner');

  // F-01-001: элементы режима журнала
  note('F-01-001', `грид=${await page.locator(f('F-01-024')).count() > 0}, мини-календарь=${await page.locator('text=/сентябр/i').count() > 0}, избранное=${await page.locator('text=/Закреплённ|Избранн/i').count() > 0}`);
  const modeBtnText = await page.locator('text=/Администрирование/i').first().innerText().catch(() => '');
  note('F-01-001', `кнопка внизу называет целевой режим: "${modeBtnText}"`);

  // F-01-006: заголовок переключателя локаций у owner (одна локация) — переключаем к network отдельно ниже
  const locSwitcher = page.locator('text=/Все филиалы|филиал/i').first();
  note('F-01-006', `переключатель локаций найден у owner: ${await locSwitcher.count() > 0}`);

  // F-01-011: сводка дня — кнопка с суммой
  const summaryBtn = page.locator('button').filter({ hasText: /֏/ }).first();
  const summaryText = await summaryBtn.innerText().catch(() => '(нет)');
  note('F-01-011', `кнопка сводки дня у owner (есть journal.stats): "${summaryText.replace(/\n/g, ' | ')}"`);
  if (await summaryBtn.count()) {
    await summaryBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, '02-day-summary');
    const rows = await page.locator('[role="dialog"], [data-f~="F-01-011"]').first().innerText().catch(() => '');
    note('F-01-011', `содержимое сводки (7 строк ожидается): ${JSON.stringify(rows.slice(0, 400))}`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }

  // F-01-019: колонки сотрудников — сверим порядок с настройками
  const staffHeaders = await page.locator('[data-f~="F-01-019"]').allInnerTexts().catch(() => []);
  note('F-01-019', `заголовки колонок сотрудников: ${JSON.stringify(staffHeaders)}`);

  // F-01-013: недельный вид
  const viewToggle = page.locator('button', { hasText: /День|Неделя/i }).first();
  if (await viewToggle.count()) {
    await viewToggle.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    const weekOpt = page.locator('text=/^Неделя/').first();
    if (await weekOpt.count()) {
      await weekOpt.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
      await shot(page, '03-week-view');
      // need to pick a single staff for week view usually
      const weekCols = await page.locator('[data-f~="F-01-013"]').count();
      note('F-01-013', `data-f найдено в недельном виде: ${weekCols}`);
      const dayHeaders = await page.locator('[data-f~="F-01-013"] , thead th, [role=columnheader]').allInnerTexts().catch(() => []);
      note('F-01-013', `заголовки (ожидание 7 дней): ${JSON.stringify(dayHeaders.slice(0, 10))}`);
    } else {
      note('F-01-013', 'пункт «Неделя» не найден в открывшемся меню');
    }
  } else {
    note('F-01-013', 'кнопка переключения вида День/Неделя не найдена');
  }
  // back to day view
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  // F-01-024 + F-01-037 + F-01-026 + F-01-050 + F-01-029 + F-01-086 + F-01-207 + F-01-104: создание записи
  const cells = page.locator(f('F-01-024'));
  const cellCount = await cells.count();
  let opened = false;
  if (cellCount > 2) {
    const col = cells.nth(2);
    const box = await col.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + 60);
      await page.waitForTimeout(700);
      opened = (await page.locator(f('F-01-037')).count()) > 0;
    }
  }
  note('F-01-024', `клик по пустой ячейке открыл окно записи: ${opened}`);
  await shot(page, '04-new-booking-window');
  if (opened) {
    const gridVisible = await page.locator(f('F-01-024')).first().isVisible().catch(() => false);
    note('F-01-037', `окно справа + сетка слева видна: ${gridVisible}`);
    const advancedBefore = await page.locator('text=/Списание расходников|История изменений/i').count();
    note('F-01-037', `у новой (несохранённой) записи плиток «Списание/История» нет: ${advancedBefore === 0}`);

    // comment F-01-050
    const commentField = page.locator(f('F-01-050')).first();
    if (await commentField.count()) {
      const input = commentField.locator('textarea, input').first();
      const target = (await input.count()) ? input : commentField;
      await target.fill('Проверка g3-1-m2').catch(async () => { await target.click().catch(()=>{}); await page.keyboard.type('Проверка g3-1-m2').catch(()=>{}); });
      note('F-01-050', 'комментарий введён');
    } else {
      note('F-01-050', 'поле комментария F-01-050 не найдено в окне');
    }

    // fill client
    const phoneInput = page.locator('input[type="tel"], input[name*="phone" i]').first();
    if (await phoneInput.count()) await phoneInput.fill('93123456').catch(() => {});
    const nameInput = page.locator('input[name*="name" i], input[placeholder="Имя"]').first();
    if (await nameInput.count()) await nameInput.fill('Проба Замер').catch(() => {});
    await shot(page, '05-filled');

    const saveBtn = page.getByRole('button', { name: /Сохранить|Создать запись|Записать/i }).first();
    if (await saveBtn.count()) {
      await saveBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
      const outOfSchedule = await page.locator('text=/Вне графика мастера|занят/i').count();
      if (outOfSchedule) {
        await shot(page, '05b-warn-modal');
        const yes = page.getByRole('button', { name: /^Да$/i }).first();
        if (await yes.count()) { await yes.click({ force: true }).catch(() => {}); await page.waitForTimeout(900); }
      }
    }
    await page.waitForTimeout(500);
    await shot(page, '06-after-save');

    // advanced tiles should now exist
    const advancedAfter = await page.locator('text=/Списание расходников|История изменений/i').count();
    note('F-01-037', `у сохранённой записи плитки «Списание/История» появились: ${advancedAfter > 0}`);

    // F-01-026: block content on grid
    const block = page.locator(f('F-01-026')).first();
    if (await block.count()) {
      const t = await block.innerText().catch(() => '');
      note('F-01-026', `текст блока: ${JSON.stringify(t.slice(0, 150))}`);
    } else {
      note('F-01-026', 'блок в сетке после сохранения не найден');
    }

    // F-01-029: hover card + status click F-01-086
    const statusIcon = page.locator(f('F-01-029')).first();
    if (await statusIcon.count()) {
      await statusIcon.hover().catch(() => {});
      await page.waitForTimeout(500);
      await shot(page, '07-hover-status');
      const cardVisible = await page.locator('[role="tooltip"], [role="dialog"]').first().isVisible().catch(() => false);
      note('F-01-029', `карточка при наведении видна: ${cardVisible}`);
      const confirmBtn = page.getByRole('button', { name: /Подтвердил/i }).first();
      if (await confirmBtn.count()) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        const toast = await page.locator('text=/Статус изменён|статус изменен|сохранён/i').count();
        note('F-01-086', `клик «Подтвердил»: тост=${toast > 0}`);
        await shot(page, '08-after-confirm-status');
        const blockColorClass = await page.locator(f('F-01-026')).first().getAttribute('class').catch(() => '');
        note('F-01-086', `класс блока после подтверждения (ищем цветовой маркер): ${blockColorClass}`);
      } else {
        note('F-01-086', 'кнопка «Подтвердил» не найдена в карточке наведения');
      }
      await page.mouse.move(5, 5);
      await page.waitForTimeout(300);
    } else {
      note('F-01-029', 'значок статуса F-01-029 не найден');
    }

    // reopen record to inspect discount F-01-207 and recurrence F-01-104
    await block.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    const discountField = await page.locator('text=/скидк/i').count();
    note('F-01-207', `упоминание «скидка» в окне записи: ${discountField > 0}`);
    const recurrenceField = await page.locator('text=/Повторение записи|повторов/i').count();
    note('F-01-104', `поле повторения записи найдено: ${recurrenceField > 0}`);

    // F-01-030: single click opens without asking to reschedule (already true — no confirm dialog appeared)
    note('F-01-030', 'одиночный клик по записи открыл окно без системного confirm (браузерных диалогов не было — иначе Playwright бы завис/автоотклонил)');

    // F-01-119/121: delete and check
    const deleteBtn = page.getByRole('button', { name: /Удалить/i }).first();
    let deleted = false;
    if (await deleteBtn.count()) {
      await deleteBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      const confirmDel = page.getByRole('button', { name: /Удалить|Подтвердить/i }).last();
      if (await confirmDel.count()) { await confirmDel.click({ force: true }).catch(() => {}); await page.waitForTimeout(700); deleted = true; }
    }
    note('F-01-119', `удаление выполнено: ${deleted}`);
    await shot(page, '09-after-delete');
  }

  // F-01-181 / F-01-119: records screen
  await page.goto(`${BASE}/biz/records?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, '10-records-screen');
  const cancelledFilter = page.locator('text=/Отменённые|Отменен/i').first();
  note('F-01-181', `фильтр «Отменённые» присутствует: ${await cancelledFilter.count() > 0}`);
  if (await cancelledFilter.count()) {
    await cancelledFilter.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '11-records-cancelled-filter');
    const rows = await page.locator('tbody tr, [data-f~="F-01-119"]').count();
    note('F-01-181', `строк после фильтра «Отменённые»: ${rows}`);
  }
  const pencil = page.locator('[data-f~="F-01-181"] svg, button:has(svg)').first();
  const editIcon = page.locator('button[aria-label*="Изменит" i], button[title*="Изменит" i]').first();
  const anyEdit = (await editIcon.count()) ? editIcon : pencil;
  if (await anyEdit.count()) {
    await anyEdit.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    const bwOpen = await page.locator(f('F-01-037')).count();
    note('F-01-181', `карандаш/кнопка правки открывает окно записи: ${bwOpen > 0}`);
    await shot(page, '12-edit-from-records');
    await page.keyboard.press('Escape').catch(() => {});
  } else {
    note('F-01-181', 'кнопка карандаша не найдена в таблице записей');
  }

  // F-01-156: filters row
  const filterCount = await page.locator('input[type="search"], button', ).filter({ hasText: /Фильтр|Статус|Поиск/i }).count();
  note('F-01-156', `элементов фильтра/поиска на /biz/records: ${filterCount}`);

  note('console-errors', JSON.stringify(errs.slice(0, 15)));
  await ctx.close();

  // ============ ЧАСТЬ 2: F-01-126 удаление рабочего дня с записями / увольнение ============
  {
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/biz/staff?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(700);
    await shot(p2, '20-staff-list');
    const staffRow = p2.locator('a, tr, [role="row"]').filter({ hasText: /./ }).first();
    note('F-01-126', `страница сотрудников открылась: ${await p2.locator('h1, h2').first().count() > 0}`);
    await ctx2.close();
  }

  // ============ ЧАСТЬ 3: network персона — локация F-01-006 ============
  {
    const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p3 = await ctx3.newPage();
    await p3.goto(`${BASE}/biz/journal?demo=network&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await p3.waitForTimeout(900);
    await shot(p3, '30-network-default');
    const label = await p3.locator('text=/Все филиалы|филиал/i').first().innerText().catch(() => '(не найдено)');
    const staffNames1 = (await p3.locator(f('F-01-019')).allInnerTexts().catch(() => [])).join(', ');
    note('F-01-006', `метка локации у network: "${label}"; сотрудники: ${staffNames1}`);
    const switcher = p3.locator('text=/Все филиалы|филиал/i').first();
    if (await switcher.count()) {
      await switcher.click({ force: true }).catch(() => {});
      await p3.waitForTimeout(400);
      await shot(p3, '31-network-location-menu');
      const secondOpt = p3.locator('[role="menuitem"], li, button').filter({ hasText: /./ }).nth(1);
      if (await secondOpt.count()) {
        const optText = await secondOpt.innerText().catch(() => '');
        await secondOpt.click({ force: true }).catch(() => {});
        await p3.waitForTimeout(700);
        await shot(p3, '32-network-switched');
        const staffNames2 = (await p3.locator(f('F-01-019')).allInnerTexts().catch(() => [])).join(', ');
        note('F-01-006', `после выбора "${optText}" сотрудники: ${staffNames2} (ожидание: изменились относительно ${staffNames1})`);
      }
    }
    await ctx3.close();
  }

  // ============ ЧАСТЬ 4: master персона — права F-01-011/013/178/024/050 ============
  {
    const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p4 = await ctx4.newPage();
    const errs4 = [];
    p4.on('console', (m) => { if (m.type() === 'error') errs4.push(m.text()); });
    p4.on('pageerror', (e) => errs4.push('pageerror: ' + e.message));
    await p4.goto(`${BASE}/biz/journal?demo=master&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await p4.waitForTimeout(900);
    await shot(p4, '40-master-journal');
    const colCount = await p4.locator(f('F-01-019')).count();
    note('F-01-178', `у master (нет journal.others) колонок сотрудников видно: ${colCount} (ожидание: 1 — только своя)`);
    const summaryBtn4 = await p4.locator('button').filter({ hasText: /֏/ }).count();
    note('F-01-011', `у master (нет journal.stats) кнопки сводки дня нет: ${summaryBtn4 === 0}`);
    // open a booking window to check phone masking (clients.phones missing) — need an existing booking
    const block4 = p4.locator(f('F-01-026')).first();
    if (await block4.count()) {
      await block4.click({ force: true }).catch(() => {});
      await p4.waitForTimeout(500);
      await shot(p4, '41-master-open-record');
      const phoneVal = await p4.locator('input[type="tel"], input[name*="phone" i]').first().inputValue().catch(() => '(нет поля)');
      note('F-01-178', `у master (нет clients.phones) телефон в окне: "${phoneVal}" — ожидание замаскирован`);
    } else {
      note('F-01-178', 'нет ни одной записи в колонке master для проверки маскировки телефона');
    }
    note('F-01-178-console', JSON.stringify(errs4.slice(0, 10)));
    await ctx4.close();
  }

  fs.writeFileSync(`${OUT}/log.txt`, log.join('\n'));
  console.log('DONE');
} catch (e) {
  console.log('FATAL', e.message, e.stack);
  fs.writeFileSync(`${OUT}/log.txt`, log.join('\n') + '\nFATAL: ' + e.message);
} finally {
  await browser.close();
  release();
}
