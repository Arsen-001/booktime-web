// Фокус: завершается ли сохранение записи вне графика, работает ли удаление и всплывающая карточка.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal/g3-1-m0';
fs.mkdirSync(OUT, { recursive: true });
const f = (id) => `[data-f~="${id}"]`;
const log = [];
const note = (id, msg) => { log.push(`${id}: ${msg}`); console.log(id, msg); };
async function shot(page, name) { await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {}); }

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Кликаем в заведомо рабочее и пустое время — колонка 3 (Сона Григорян), полностью пустая на весь день
  await page.mouse.click(1055, 560);
  await page.waitForTimeout(700);
  const opened = await page.locator(f('F-01-037')).count();
  note('setup', `окно открыто в рабочее время: ${opened > 0}`);
  await shot(page, '11-new-record-working-hours');

  const phoneInput = page.locator('input[type="tel"]').first();
  if (await phoneInput.count()) await phoneInput.fill('95000111').catch(() => {});
  const saveBtn = page.getByRole('button', { name: /Записать/i }).first();
  await saveBtn.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1500);
  const outOfSchedule = await page.locator('text=/Вне графика мастера/i').count();
  note('F-01-215', `предупреждение «вне графика мастера» при записи в пустую, но нерабочую ячейку: ${outOfSchedule > 0} (наша модалка, не системный confirm)`);
  if (outOfSchedule > 0) {
    const yesBtn = page.getByRole('button', { name: /^Да$/i }).first();
    if (await yesBtn.count()) { await yesBtn.click({ force: true }).catch(() => {}); await page.waitForTimeout(1200); }
  }
  const stillOpen = await page.locator(f('F-01-037')).count();
  note('save', `окно всё ещё открыто после сохранения в рабочее время: ${stillOpen > 0} (ожидание: закрылось = false)`);
  await shot(page, '12-after-save-working-hours');

  // Если окно закрылось — на сетке должен появиться новый блок; кликаем по нему
  await page.waitForTimeout(500);
  const blocks = page.locator(f('F-01-026'));
  const blockCount = await blocks.count();
  note('F-01-026', `блоков записей на сетке после сохранения: ${blockCount}`);

  // Наводим на значок статуса первого блока с телефоном 95000111
  let targetBlock = null;
  for (let i = 0; i < blockCount; i++) {
    const t = await blocks.nth(i).innerText().catch(() => '');
    if (t.includes('95 000 111') || t.includes('950 00 111') || t.includes('95000111') || t.includes('95 000111') || t.includes('+374 95')) { targetBlock = blocks.nth(i); break; }
  }
  if (!targetBlock) targetBlock = blocks.last();
  await targetBlock.scrollIntoViewIfNeeded().catch(() => {});
  const statusIcon = targetBlock.locator(f('F-01-029')).first();
  const iconCount = await statusIcon.count();
  note('F-01-029', `значок статуса внутри блока найден: ${iconCount > 0}`);
  if (iconCount > 0) {
    await statusIcon.hover({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '13-hover-card');
    const hoverCardVisible = await page.locator('text=/Ожидание|Клиент пришел|Подтвердил/i').count();
    note('F-01-029', `карточка со статусами показана при наведении: ${hoverCardVisible > 0}`);
    if (hoverCardVisible > 0) {
      const confirmBtn = page.getByRole('button', { name: /Подтвердил/i }).first();
      if (await confirmBtn.count()) {
        await confirmBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(600);
        const toast = await page.locator('text=/Статус изменён|статус изменен|изменён/i').count();
        note('F-01-086', `после клика «Подтвердил» появился тост: ${toast > 0}`);
        await shot(page, '14-after-confirm-status');
      }
    }
    await page.mouse.move(5, 5);
    await page.waitForTimeout(300);
  }

  // Открываем блок и удаляем
  await targetBlock.click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
  const bwOpen2 = await page.locator(f('F-01-037')).count();
  note('F-01-030', `клик по записи открыл окно (2й прогон): ${bwOpen2 > 0}`);
  await shot(page, '15-open-for-delete');
  // ищем иконку/кнопку удаления по aria-label или иконке корзины
  const delCandidates = [
    page.getByRole('button', { name: /Удалить/i }),
    page.locator('button[aria-label*="Удал" i]'),
    page.locator('button[title*="Удал" i]'),
  ];
  let delBtn = null;
  for (const c of delCandidates) { if (await c.count()) { delBtn = c.first(); break; } }
  note('F-01-119', `кнопка удаления найдена: ${!!delBtn}`);
  if (delBtn) {
    await delBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    await shot(page, '16-delete-confirm-dialog');
    const confirmDel = page.getByRole('button', { name: /Удалить|Да|Подтвердить/i }).last();
    if (await confirmDel.count()) {
      await confirmDel.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
    }
    const toastDel = await page.locator('text=/Запись отменена|запись удалена/i').count();
    note('F-01-119', `тост об удалении: ${toastDel > 0}`);
    await shot(page, '17-after-delete');
  }

  // F-01-119: тот же браузерный контекст (та же mock-«база» в памяти) -> отчёт «Записи»
  await page.goto(`${BASE}/biz/records?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const redRows = page.locator(f('F-01-119'));
  const redCount = await redRows.count();
  note('F-01-119', `строк с меткой удаления на /biz/records (тот же сеанс): ${redCount}`);
  if (redCount > 0) {
    const rowWithOurPhone = redRows.filter({ hasText: '95 000 111' });
    const found = await rowWithOurPhone.count();
    note('F-01-119', `среди них найдена наша удалённая запись (95 000 111): ${found > 0}`);
    if (found > 0) {
      const txt = await rowWithOurPhone.first().innerText().catch(() => '');
      note('F-01-119', `текст строки: ${JSON.stringify(txt.slice(0, 300))}`);
    }
    await shot(page, '18-records-with-deleted');
  }

  note('console-errors', JSON.stringify(consoleErrors.slice(0, 20)));
  fs.writeFileSync(`${OUT}/log2.txt`, log.join('\n'));
  await ctx.close();
} finally {
  await browser.close();
  release();
}
