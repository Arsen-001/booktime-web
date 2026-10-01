// Измеритель g2-1-m1: ручной прогон нескольких F-id живыми действиями.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal/g2-1-m1';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (id, msg) => { log.push(`${id}: ${msg}`); console.log(id, msg); };

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
}

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  // ---- 1. Основной проход: owner / nails / ru / desktop ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, '01-journal');

  const f = (id) => `[data-f~="${id}"]`;

  // F-01-024/037: клик по явно пустой ячейке (данные не даём — берём вторую, где обычно пусто)
  const emptyCount = await page.locator(f('F-01-024')).count();
  note('F-01-024', `ячеек с data-f найдено: ${emptyCount}`);
  const emptyCandidates = page.locator(f('F-01-024'));
  // ищем ячейку без блока записи внутри (пустая ячейка)
  let clickedEmpty = false;
  for (let i = 0; i < Math.min(emptyCount, 30) && !clickedEmpty; i++) {
    const cand = emptyCandidates.nth(i);
    const hasBookingChild = await cand.locator('[data-f~="F-01-026"]').count();
    if (hasBookingChild === 0) {
      await cand.click({ force: true }).catch(() => {});
      clickedEmpty = true;
    }
  }
  if (clickedEmpty) {
    await page.waitForTimeout(500);
    const windowOpen = await page.locator(f('F-01-037')).count();
    note('F-01-037', `окно записи после клика по ПУСТОЙ ячейке видно: ${windowOpen > 0}`);
    await shot(page, '02-after-empty-cell-click');
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  } else {
    note('F-01-024', 'не нашёл явно пустую ячейку среди первых 30 — пропускаю');
  }

  // F-01-030: клик по существующей записи
  const bookingBlocks = page.locator(f('F-01-026'));
  const bCount = await bookingBlocks.count();
  note('F-01-030/026', `блоков записей на сетке: ${bCount}`);
  if (bCount > 0) {
    let dialogSeen = false;
    page.once('dialog', (d) => { dialogSeen = true; d.dismiss().catch(() => {}); });
    await bookingBlocks.first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    const win = await page.locator(f('F-01-037')).count();
    note('F-01-030', `одиночный клик открыл окно: ${win > 0}; нативный confirm/dialog появился: ${dialogSeen}`);
    await shot(page, '03-booking-window-open');

    // F-01-086: кнопки статуса
    const statusBtns = await page.locator(f('F-01-086')).count();
    note('F-01-086', `кнопок статуса найдено: ${statusBtns}`);
    if (statusBtns > 1) {
      await page.locator(f('F-01-086')).nth(1).click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      await shot(page, '04-after-status-click');
    }

    // F-01-050: комментарий
    const hasComment = await page.locator(f('F-01-050')).count();
    note('F-01-050', `поле комментария найдено: ${hasComment}`);

    // F-01-207: скидка (личная скидка клиента — автоприменение)
    const discount = await page.locator(f('F-01-207')).count();
    note('F-01-207', `элемент личной скидки (data-f) найден: ${discount}`);

    // F-01-104: повторы — раскрыть «Повторение записи»
    const recBtn = page.locator('text=/Повторение записи/').first();
    if (await recBtn.count()) {
      await recBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
      const recurrence = await page.locator(f('F-01-104')).count();
      note('F-01-104', `после раскрытия «Повторение записи» — элемент найден: ${recurrence}`);
      await shot(page, '04b-recurrence-open');
    } else {
      note('F-01-104', 'заголовок «Повторение записи» не найден для раскрытия');
    }

    // F-01-064: подсказка клиента при вводе номера
    const clientHint = await page.locator(f('F-01-064')).count();
    note('F-01-064', `зона подсказки клиента (data-f) найдена: ${clientHint}`);

    // F-01-119/121: удалить запись через иконку корзины, проверить тост-undo и data-f
    const trashBtn = page.locator('button:has([class*="trash" i]), button[aria-label*="дал" i]').first();
    let deleted = false;
    if (await trashBtn.count()) {
      await trashBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      const confirmBtn = page.locator('[role="dialog"] button, .modal button').filter({ hasText: /Удалить|Отменить запись|Да/ }).first();
      if (await confirmBtn.count()) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        deleted = true;
      }
      await shot(page, '05-after-delete');
    }
    if (deleted) {
      const undoBtn = page.locator(f('F-01-121'));
      const undoCount = await undoBtn.count();
      note('F-01-121', `кнопка undo с data-f~="F-01-121" в тосте: ${undoCount}`);
      const undoByText = page.locator('text=/Отменить/').last();
      if (await undoByText.count()) {
        await undoByText.click({ force: true }).catch(() => {});
        await page.waitForTimeout(600);
        await shot(page, '06-after-undo');
        const stillThere = await page.locator(f('F-01-026')).count();
        note('F-01-121', `после клика по «Отменить» в тосте — блоков записей на сетке: ${stillThere} (было ${bCount})`);
      }
    } else {
      note('F-01-119/121', 'не удалось найти/пройти кнопку удаления записи в этом заходе (см. скриншот 03/05)');
    }
  }

  // F-01-006: переключатель локаций (фундамент, shell)
  const locSwitch = page.locator('header button, [class*="LocationSwitcher" i]').filter({ hasText: /Nuri|Студия|Филиал/ });
  note('F-01-006', `кандидатов переключателя локации в шапке: ${await locSwitch.count()}`);

  // F-01-156: панель листа ожидания — открыть, перезагрузить, проверить состояние
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  const waitlistBtn = page.locator('text=/Лист ожидания/').first();
  if (await waitlistBtn.count()) {
    await waitlistBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    const openBefore = await page.locator(f('F-01-156')).isVisible().catch(() => false);
    note('F-01-156', `панель видна ДО перезагрузки: ${openBefore}`);
    await shot(page, '07-waitlist-open');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const panelVisibleAfterReload = await page.locator(f('F-01-156')).isVisible().catch(() => false);
    note('F-01-156', `панель листа ожидания видна ПОСЛЕ перезагрузки: ${panelVisibleAfterReload}`);
    await shot(page, '08-waitlist-after-reload');
  } else {
    note('F-01-156', 'кнопка «Лист ожидания» не найдена');
  }

  // F-01-181/178, /biz/records — cancelled tab red row after our own delete
  await page.goto(`${BASE}/biz/records?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const cancelledTab = page.locator('text=/Отменённые/').first();
  if (await cancelledTab.count()) {
    await cancelledTab.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '09-cancelled-tab');
    const redRows = await page.locator('[data-row-danger]').count();
    note('F-01-119/181', `строк с [data-row-danger] на вкладке «Отменённые»: ${redRows}`);
  } else {
    note('F-01-181', 'вкладка «Отменённые» не найдена на /biz/records');
  }

  note('CONSOLE', `ошибок консоли/страницы за проход: ${consoleErrors.length} :: ${consoleErrors.slice(0, 5).join(' | ')}`);
  await ctx.close();

  // ---- 2. Групповые события: fitness/groups sphere ----
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/biz/journal?demo=owner&sphere=fitness&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page2.waitForTimeout(700);
  await shot(page2, '10-fitness-journal');
  const f2 = (id) => `[data-f~="${id}"]`;
  const mixedChoice = await page2.locator(f2('F-01-025')).count();
  note('F-01-025/035/194', `сфера fitness: элемент выбора Запись/Событие на странице (до клика): ${mixedChoice}`);
  const groupEventEls = await page2.locator(f2('F-01-035')).count();
  note('F-01-035', `блоков групповых событий на сетке (fitness): ${groupEventEls}`);
  // клик по пустой ячейке, если есть — по ТЗ на смешанном журнале должен спросить «Запись/Событие»
  const emptyCells2 = page2.locator(f2('F-01-024'));
  const ec2 = await emptyCells2.count();
  let clicked2 = false;
  for (let i = 0; i < Math.min(ec2, 30) && !clicked2; i++) {
    const cand = emptyCells2.nth(i);
    if ((await cand.locator(f2('F-01-026')).count()) === 0) {
      await cand.click({ force: true }).catch(() => {});
      clicked2 = true;
    }
  }
  if (clicked2) {
    await page2.waitForTimeout(400);
    await shot(page2, '11-fitness-after-cell-click');
    const choiceAfter = await page2.locator(f2('F-01-025')).count();
    note('F-01-025', `после клика по пустой ячейке (fitness) — выбор Запись/Событие видно: ${choiceAfter > 0}`);
    const eventChoiceBtn = page2.locator('text=/Событие/').first();
    if (await eventChoiceBtn.count()) {
      await eventChoiceBtn.click({ force: true }).catch(() => {});
      await page2.waitForTimeout(400);
      await shot(page2, '11b-fitness-event-chosen');
    }
  } else {
    note('F-01-024', 'fitness: пустая ячейка не найдена среди первых 30');
  }
  for (const fid of ['F-01-194', 'F-01-195', 'F-01-196', 'F-01-197', 'F-01-198', 'F-01-199', 'F-01-200', 'F-01-216', 'F-01-218', 'F-01-108']) {
    const c = await page2.locator(f2(fid)).count();
    note(fid, `элементов на экране: ${c}`);
  }
  await ctx2.close();

  // ---- 3. Медкарта: cosmetology/dental sphere ----
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page3 = await ctx3.newPage();
  await page3.goto(`${BASE}/biz/journal?demo=owner&sphere=dental&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page3.waitForTimeout(700);
  const blocks3 = page3.locator('[data-f~="F-01-026"]');
  if (await blocks3.count()) {
    await blocks3.first().click({ force: true }).catch(() => {});
    await page3.waitForTimeout(500);
    await shot(page3, '12-dental-booking-window');
    const med = await page3.locator('[data-f~="F-01-190"]').count();
    note('F-01-190', `плитка «Медкарта» найдена (dental): ${med}`);
    if (med) {
      await page3.locator('[data-f~="F-01-190"]').first().click({ force: true }).catch(() => {});
      await page3.waitForTimeout(400);
      await shot(page3, '13-dental-medcard-open');
    }
  } else {
    note('F-01-190', 'нет записей на сетке dental для клика в этом заходе');
  }
  await ctx3.close();

  fs.writeFileSync(`${OUT}/log.txt`, log.join('\n'));
} finally {
  await browser.close();
  release();
}
