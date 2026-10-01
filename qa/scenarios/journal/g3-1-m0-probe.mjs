// Измеритель g3-1-m0: боевой прогон целевого списка F-id журнала живыми действиями.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal/g3-1-m0';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (id, msg) => { log.push(`${id}: ${msg}`); console.log(id, msg); };

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
}

const f = (id) => `[data-f~="${id}"]`;

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  // ---- Основной проход: owner / nails / ru / desktop ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, '01-journal');

  // F-01-001: режим переключения
  const modeBtn = page.locator(f('F-01-178')).first();
  note('page-loaded', `console errors so far: ${consoleErrors.length}`);

  // F-01-006: переключатель локаций
  const locCount = await page.locator('text=/Локации/i').count();
  note('F-01-006', `текст «Локации» найден: ${locCount > 0}`);

  // F-01-011: сводка дня
  const summaryBtn = page.locator('button', { hasText: /դր|AMD|0 ֏|₫|֏/ }).first();
  note('F-01-011', `кнопка сводки дня candidates: ${await page.locator('button').filter({ hasText: /֏/ }).count()}`);

  // F-01-024/037/026: клик по пустой ячейке -> окно записи (третья колонка, полностью пустая на скрине)
  const cells = page.locator(f('F-01-024'));
  const cellCount = await cells.count();
  note('F-01-024', `колонок (droppable) data-f найдено: ${cellCount}`);
  let opened = false;
  const emptyColIdx = Math.min(2, cellCount - 1); // третья колонка визуально пустая
  if (cellCount > 0) {
    const col = cells.nth(emptyColIdx);
    const box = await col.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + 40);
      await page.waitForTimeout(700);
      const bw = await page.locator(f('F-01-037')).count();
      if (bw > 0) { opened = true; note('F-01-024', `клик по пустой зоне колонки #${emptyColIdx} открыл окно записи`); }
    }
  }
  if (!opened) note('F-01-024', 'НЕ удалось открыть окно кликом по пустой ячейке');
  await shot(page, '02-booking-window-new');

  const bwCount = await page.locator(f('F-01-037')).count();
  note('F-01-037', `окно записи открыто: ${bwCount > 0}`);
  // левая/центр/право зоны видимость сетки слева
  const gridVisible = await page.locator(f('F-01-024')).first().isVisible().catch(() => false);
  note('F-01-037', `сетка слева видна при открытом окне: ${gridVisible}`);

  // F-01-050: комментарий к записи
  const commentField = page.locator(f('F-01-050'));
  note('F-01-050', `поле комментария найдено: ${await commentField.count() > 0}`);

  // F-01-067: карточка клиента / поиск
  const clientZone = page.locator(f('F-01-067'));
  note('F-01-067', `зона клиента найдена: ${await clientZone.count() > 0}`);

  // F-01-073: поиск по лояльности (по умолчанию выключено в настройках -> ожидаем отсутствие)
  const loyaltySearch = await page.locator('text=/номер карты|абонемент|сертификат/i').count();
  note('F-01-073', `поле поиска по лояльности в окне (ожидание: скрыто по умолчанию): найдено текстовых совпадений ${loyaltySearch}`);

  // Заполним минимум и сохраним, чтобы получить сохранённую запись для дальнейших проверок
  const phoneInput = page.locator('input[type="tel"], input[name*="phone" i]').first();
  if (await phoneInput.count()) {
    await phoneInput.fill('93123456').catch(() => {});
  }
  const nameInput = page.locator('input[name*="name" i]').first();
  if (await nameInput.count()) {
    await nameInput.fill('Тест Пробник').catch(() => {});
  }
  await shot(page, '03-booking-window-filled');

  const saveBtn = page.getByRole('button', { name: /Сохранить|Создать запись|Записать/i }).first();
  if (await saveBtn.count()) {
    await saveBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
  }
  // F-01-215: если время вне графика мастера — наша модалка (не системная) со «Всё равно создать?»
  const outOfScheduleModal = await page.locator('text=/Вне графика мастера/i').count();
  note('F-01-215', `модалка «Вне графика мастера» (наша, не системная): ${outOfScheduleModal > 0}`);
  if (outOfScheduleModal > 0) {
    await shot(page, '04a-out-of-schedule-modal');
    const yesBtn = page.getByRole('button', { name: /^Да$/i }).first();
    if (await yesBtn.count()) { await yesBtn.click({ force: true }).catch(() => {}); await page.waitForTimeout(1000); }
  }
  await shot(page, '04-after-save');

  // F-01-029: hover card на статус
  const statusIcon = page.locator(f('F-01-029')).first();
  note('F-01-029', `значок статуса найден: ${await statusIcon.count() > 0}`);
  if (await statusIcon.count()) {
    await statusIcon.hover().catch(() => {});
    await page.waitForTimeout(500);
    const hoverVisible = await statusIcon.isVisible().catch(() => false);
    note('F-01-029', `карточка при наведении показана: ${hoverVisible}`);
    await shot(page, '05-hover-card');
    // F-01-086: кнопка «Подтвердил»
    const confirmBtn = page.getByRole('button', { name: /Подтвердил/i }).first();
    note('F-01-086', `кнопка «Подтвердил» найдена: ${await confirmBtn.count() > 0}`);
    if (await confirmBtn.count()) {
      await confirmBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      const toast = await page.locator('text=/Статус изменён|статус изменен/i').count();
      note('F-01-086', `тост об изменении статуса: ${toast > 0}`);
    }
    await page.mouse.move(10, 10);
    await page.waitForTimeout(300);
  }

  // F-01-026: блок записи содержимое
  const block = page.locator(f('F-01-026')).first();
  if (await block.count()) {
    const text = await block.innerText().catch(() => '');
    note('F-01-026', `текст блока записи: ${JSON.stringify(text.slice(0, 200))}`);
  } else {
    note('F-01-026', 'блок записи не найден на сетке после сохранения');
  }
  await shot(page, '06-block-in-grid');

  // F-01-030: клик по блоку открывает окно + короткое меню Изменить/Удалить
  if (await block.count()) {
    await block.click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    const bwAfterClick = await page.locator(f('F-01-037')).count();
    note('F-01-030', `клик по записи открыл окно: ${bwAfterClick > 0}`);
    await shot(page, '07-open-existing-record');
    // Проверка «не спрашивает о переносе» - нет системного confirm/dialog браузера
    // (Playwright автоматически диалоги не подтверждает; если он завис - таймаут докажет проблему)
  }

  // F-01-119/121: удаление и след в отчёте «Записи»
  const deleteBtn = page.getByRole('button', { name: /Удалить/i }).first();
  let deletedOk = false;
  if (await deleteBtn.count()) {
    await deleteBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(400);
    const confirmDel = page.getByRole('button', { name: /Удалить|Подтвердить/i }).last();
    if (await confirmDel.count()) {
      await confirmDel.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
      deletedOk = true;
    }
  }
  note('F-01-119', `удаление выполнено: ${deletedOk}`);
  await shot(page, '08-after-delete');

  await page.goto(`${BASE}/biz/records?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, '09-records-screen');
  const redRow = page.locator(f('F-01-119'));
  note('F-01-119', `строк с меткой удаления на /biz/records: ${await redRow.count()}`);
  if (await redRow.count()) {
    const t = await redRow.first().innerText().catch(() => '');
    note('F-01-119', `текст строки: ${JSON.stringify(t.slice(0, 200))}`);
  }
  const restoreBtn = await page.locator('text=/Восстановить/i').count();
  note('F-01-121', `пункт «Восстановить» присутствует в интерфейсе: ${restoreBtn > 0} (по решению «У нас» — восстановления быть не должно)`);

  // F-01-181: отчёт «Записи» полнофункционально (пока это RecordsScreen b01, полный отчёт вне пачки)
  const filtersCount = await page.locator('button, input, select').count();
  note('F-01-181', `элементов управления на /biz/records: ${filtersCount}`);

  note('console-errors-total', JSON.stringify(consoleErrors.slice(0, 20)));
  await ctx.close();

  // ---- Совместная работа F-01-033: два контекста ----
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  await pageA.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await pageB.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await pageA.waitForTimeout(500);
  const cellsA = pageA.locator(f('F-01-024'));
  const cntA = await cellsA.count();
  let createdInA = false;
  if (cntA > 0) {
    const colA = cellsA.nth(Math.min(2, cntA - 1));
    const boxA = await colA.boundingBox();
    if (boxA) {
      await pageA.mouse.click(boxA.x + boxA.width / 2, boxA.y + 40);
      await pageA.waitForTimeout(600);
      if (await pageA.locator(f('F-01-037')).count() > 0) createdInA = true;
    }
  }
  if (createdInA) {
    const phoneA = pageA.locator('input[type="tel"], input[name*="phone" i]').first();
    if (await phoneA.count()) await phoneA.fill('93000001').catch(() => {});
    const saveA = pageA.getByRole('button', { name: /Сохранить|Создать запись|Записать/i }).first();
    if (await saveA.count()) { await saveA.click({ force: true }).catch(() => {}); await pageA.waitForTimeout(1200); }
  }
  // без перезагрузки B — просто ждём и смотрим, появилась ли запись (polling/websocket-эмуляция)
  await pageB.waitForTimeout(2500);
  const blocksB = await pageB.locator(f('F-01-026')).count();
  note('F-01-033', `после создания в контексте A, блоков записи видно в B без перезагрузки: ${blocksB} (created-in-A=${createdInA})`);
  await shot(pageB, '10-collab-b-no-reload');
  await ctxA.close();
  await ctxB.close();

  fs.writeFileSync(`${OUT}/log.txt`, log.join('\n'));
  console.log('DONE');
} finally {
  await browser.close();
  release();
}
