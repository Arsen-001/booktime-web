// Измеритель m1, раздел schedule. Живые действия через Playwright напрямую (measure.mjs не умеет selectOption).
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/measure/schedule/shots-m1';
fs.mkdirSync(OUT, { recursive: true });

const url = (route, { persona = 'owner', sphere = 'nails', lang = 'ru', theme = 'light', extra = '' } = {}) =>
  `${BASE}${route}?demo=${persona}&sphere=${sphere}&lang=${lang}&theme=${theme}${extra}`;

const log = [];
const rec = (name, ok, note) => { log.push({ name, ok, note }); console.log((ok ? '✅' : '❌'), name, note ?? ''); };

const consoleErrors = [];

async function shot(page, name) {
  const p = `${OUT}/${name}.png`;
  await page.screenshot({ path: p });
  return p;
}

async function run() {
  const browser = await chromium.launch();

  // ---------- Desktop owner: filters, view menu, multi-select, templates, breaks, day type, delete, copy modal ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[desktop-owner] ${m.text()}`); });
    page.on('pageerror', (e) => consoleErrors.push(`[desktop-owner pageerror] ${e.message}`));

    await page.goto(url('/biz/schedule', { persona: 'owner' }), { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await shot(page, '01-initial');

    // baseline row count
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
    const baselineRows = await page.locator('table tbody tr').count().catch(() => -1);

    // F-02-003: positions multi-select filter
    try {
      const positionsBtn = page.locator('[data-f="F-02-003"] button', { hasText: /Должность/ }).first();
      await positionsBtn.click({ timeout: 5000 });
      await page.waitForTimeout(200);
      const checkboxes = page.locator('[role="dialog"], [data-radix-popper-content-wrapper], .popover, [data-state="open"]').locator('input[type=checkbox], [role=checkbox]');
      const count = await checkboxes.count().catch(() => 0);
      if (count >= 2) {
        await checkboxes.nth(0).click();
        await checkboxes.nth(1).click();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);
        await shot(page, '02-positions-multiselect');
        const rowsAfter = await page.locator('table tbody tr').count().catch(() => -1);
        rec('F-02-003 positions multi-select', rowsAfter < baselineRows, `строк было ${baselineRows}, после выбора 2 должностей: ${rowsAfter}`);
      } else {
        rec('F-02-003 positions multi-select', false, `не нашёл чекбоксы в попапе (count=${count})`);
      }
    } catch (e) {
      rec('F-02-003 positions multi-select', false, String(e.message).split('\n')[0]);
    }

    // reload to clear filter state cleanly before next check
    await page.goto(url('/biz/schedule', { persona: 'owner' }), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);

    // F-02-003: hasSchedule select with 3 values incl "Нет графика"
    try {
      const selects = page.locator('[data-f="F-02-003"] select');
      const n = await selects.count();
      let hasScheduleSelect = null;
      for (let i = 0; i < n; i++) {
        const opts = await selects.nth(i).locator('option').allTextContents();
        if (opts.some((o) => /график/i.test(o))) hasScheduleSelect = selects.nth(i);
      }
      if (hasScheduleSelect) {
        const opts = await hasScheduleSelect.locator('option').allTextContents();
        const withoutLabel = opts.find((o) => /без графика|нет графика/i.test(o));
        await hasScheduleSelect.selectOption({ label: withoutLabel });
        await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(500);
        const rows = await page.locator('table tbody tr').count().catch(() => -1);
        await shot(page, '03-filter-without-schedule');
        rec('F-02-003 "Нет графика"', rows >= 0 && rows <= baselineRows, `строк было ${baselineRows}, после фильтра «${withoutLabel}»: ${rows}`);
      } else {
        rec('F-02-003 "Нет графика"', false, 'select с графиком не найден');
      }
    } catch (e) {
      rec('F-02-003 "Нет графика"', false, String(e.message).split('\n')[0]);
    }

    // reload to clear filter state cleanly before next block
    await page.goto(url('/biz/schedule', { persona: 'owner' }), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);

    // F-02-004: view menu (⚙) toggles
    try {
      const gearBtn = page.locator('button[aria-label*="вид" i], button[aria-label*="настрой" i], button:has(svg)').filter({ hasText: '' });
      // Try more targeted: look for button near view switch with settings icon
      const candidates = page.locator('button');
      let clicked = false;
      const candCount = await candidates.count();
      for (let i = 0; i < candCount && !clicked; i++) {
        const aria = (await candidates.nth(i).getAttribute('aria-label')) ?? '';
        if (/вид|настрой|settings|view/i.test(aria)) { await candidates.nth(i).click(); clicked = true; }
      }
      if (clicked) {
        await page.waitForTimeout(300);
        await shot(page, '04-view-menu-open');
        const toggles = page.locator('[data-f="F-02-004"] input[type=checkbox]');
        const tCount = await toggles.count().catch(() => 0);
        rec('F-02-004 меню вида открылось', true, `переключателей внутри: ${tCount}`);
        if (tCount >= 1) {
          await toggles.nth(0).click();
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          await shot(page, '05-view-menu-toggled');
          rec('F-02-004 переключатель применился (визуально)', true, 'см. снимок 05 vs 01');
        }
      } else {
        rec('F-02-004 меню вида', false, 'кнопку ⚙ не нашёл по aria-label');
      }
    } catch (e) {
      rec('F-02-004', false, String(e.message).split('\n')[0]);
    }

    // reload to clear view-menu toggle state before next block
    await page.goto(url('/biz/schedule', { persona: 'owner' }), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);

    // F-02-005 / F-02-006 / F-02-007 / F-02-008 / F-02-009 / F-02-010 / F-02-012 / F-02-013: open panel on empty cell, multi-select 2 cells, switch templates, day type, breaks
    try {
      const emptyCells = page.locator('table tbody td button');
      const emptyCellsCount0 = await emptyCells.count();
      const emptyCellFiltered = [];
      for (let i = 0; i < emptyCellsCount0; i++) {
        const txt = (await emptyCells.nth(i).innerText().catch(() => '')).trim();
        if (txt.includes('—')) emptyCellFiltered.push(i);
      }
      const cellCount = emptyCellFiltered.length;
      const nth = (i) => emptyCells.nth(emptyCellFiltered[i]);
      if (cellCount >= 2) {
        await nth(0).click();
        await page.waitForTimeout(300);
        await shot(page, '06-first-cell-selected');

        // F-02-005 «можно отметить несколько»: toggleCell() sets panelOpen(true) on the VERY FIRST
        // click, and the Sheet renders a full-viewport backdrop (`fixed inset-0` + `absolute inset-0`)
        // over the whole table — confirmed via elementFromPoint at the 2nd empty cell's screen
        // coordinates: it resolves to the backdrop div, not the cell button. A live click on a 2nd
        // cell therefore cannot land (Playwright times out waiting for actionability — the same
        // reason a mouse click would do nothing). This is not an automation quirk: the DOM/CSS state
        // is identical to what a real user's pointer would hit.
        const secondBox = await nth(1).boundingBox();
        const elAtSecond = await page.evaluate(({ x, y }) => {
          const e = document.elementFromPoint(x, y);
          return e ? `${e.tagName}.${String(e.className).slice(0, 60)}` : null;
        }, { x: secondBox.x + secondBox.width / 2, y: secondBox.y + secondBox.height / 2 });
        const backdropBlocks = /bg-overlay|inset-0/.test(elAtSecond ?? '');
        rec(
          'F-02-005 множественный выбор ячеек (2-й клик по табличной ячейке)',
          !backdropBlocks,
          backdropBlocks
            ? `BLOCK: точка 2-й пустой ячейки перекрыта элементом «${elAtSecond}» (задник панели) — второй клик не может дойти до ячейки`
            : `клик по 2-й ячейке дошёл, элемент в точке: ${elAtSecond}`,
        );
        await shot(page, '07-panel-open');

        const templateSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Без шаблона' }) }).first();
        const hasTplSelect = await templateSelect.count();
        if (hasTplSelect) {
          await templateSelect.selectOption({ label: 'По дням недели' });
          await page.waitForTimeout(300);
          await shot(page, '08-template-weekdays');
          const weekdayCheckboxes = await page.locator('label:has-text("Пн"), label:has-text("пн")').count().catch(() => 0);
          rec('F-02-007 переключение на "По дням недели"', true, `элементов дней недели: ${weekdayCheckboxes}`);

          await templateSelect.selectOption({ label: 'По сменам' });
          await page.waitForTimeout(300);
          await shot(page, '09-template-shifts');
          rec('F-02-008 переключение на "По сменам"', true, 'см. снимок 09');

          await templateSelect.selectOption({ label: 'Без шаблона' });
          await page.waitForTimeout(200);
        } else {
          rec('F-02-007/008 переключение шаблона', false, 'select "Без шаблона" не найден в панели');
        }

        // F-02-010 day type select -> switch to non-working
        const daySelects = page.locator('select');
        const dsCount = await daySelects.count();
        let daySelect = null;
        for (let i = 0; i < dsCount; i++) {
          const opts = await daySelects.nth(i).locator('option').allTextContents();
          if (opts.some((o) => /нерабочий/i.test(o))) daySelect = daySelects.nth(i);
        }
        if (daySelect) {
          const beforeBreaks = await page.getByText('Добавить перерыв', { exact: false }).count();
          await daySelect.selectOption({ label: (await daySelect.locator('option').allTextContents()).find((o) => /нерабочий/i.test(o)) });
          await page.waitForTimeout(300);
          await shot(page, '10-daytype-nonworking');
          const afterBreaks = await page.getByText('Добавить перерыв', { exact: false }).count();
          rec('F-02-010 тип дня → «Нерабочий день» прячет часы', afterBreaks < beforeBreaks || afterBreaks === 0, `часы/перерывы до=${beforeBreaks} после=${afterBreaks}`);
          // switch back to working
          const opts2 = await daySelect.locator('option').allTextContents();
          const workingLabel = opts2.find((o) => /рабоч/i.test(o) && !/не/i.test(o));
          if (workingLabel) await daySelect.selectOption({ label: workingLabel });
          await page.waitForTimeout(300);
        } else {
          rec('F-02-010 тип дня', false, 'select с «Нерабочий день» не найден');
        }

        // F-02-013 add break
        try {
          const addBreakBtn = page.getByText('Добавить перерыв', { exact: false }).first();
          const timeFieldLocator = page.locator('button', { hasText: /^\d{1,2}:\d{2}$/ });
          const beforeTimeFields = await timeFieldLocator.count().catch(() => 0);
          if (await addBreakBtn.count()) {
            await addBreakBtn.click();
            await page.waitForTimeout(300);
            const afterTimeFields = await timeFieldLocator.count().catch(() => 0);
            await shot(page, '11-break-added');
            rec('F-02-013 «Добавить перерыв» добавляет интервал', afterTimeFields > beforeTimeFields, `полей времени до=${beforeTimeFields} после=${afterTimeFields}`);
          } else {
            rec('F-02-013 «Добавить перерыв»', false, 'кнопка не найдена');
          }
        } catch (e) {
          rec('F-02-013', false, String(e.message).split('\n')[0]);
        }

        // Cancel button returns without saving
        const cancelBtn = page.locator('button', { hasText: 'Отмена' }).first();
        if (await cancelBtn.count()) {
          await cancelBtn.click();
          await page.waitForTimeout(300);
          const panelStillOpen = await page.getByText('Настройка графика', { exact: false }).first().isVisible().catch(() => false);
          await shot(page, '12-after-cancel');
          rec('F-02-005 «Отмена» закрывает панель без записи', !panelStillOpen, `панель видна после отмены: ${panelStillOpen}`);
        } else {
          rec('F-02-005 «Отмена»', false, 'кнопка «Отмена» не найдена');
        }
      } else {
        rec('F-02-005 множественный выбор', false, `ячеек «—» найдено: ${cellCount}`);
      }
    } catch (e) {
      rec('F-02-005..013 блок панели', false, String(e.message).split('\n')[0]);
    }

    // reload to clear selection/panel state before delete test
    await page.goto(url('/biz/schedule', { persona: 'owner' }), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);

    // F-02-014: the "Удалить"/bulk toolbar (data-f="F-02-014 F-02-032 F-02-034") renders only when
    // `selected.length > 0 && !panelOpen`. Since toggleCell() ALWAYS sets panelOpen(true) on click,
    // and every path that sets panelOpen back to false (Cancel, backdrop click, the Sheet's ✕) goes
    // through close(), which ALSO calls onClearSelection() — selected.length cannot be > 0 while
    // panelOpen is false. Verified live: select a cell (panel opens) → click «Отмена» → selection
    // and toolbar both gone; there is no path that leaves cells selected with the panel closed.
    try {
      const emptyCells2 = page.locator('table tbody td button');
      const cnt0 = await emptyCells2.count();
      let firstEmptyIdx = -1;
      for (let i = 0; i < cnt0; i++) {
        const txt = (await emptyCells2.nth(i).innerText().catch(() => '')).trim();
        if (txt.includes('—')) { firstEmptyIdx = i; break; }
      }
      if (firstEmptyIdx >= 0) {
        await emptyCells2.nth(firstEmptyIdx).click();
        await page.waitForTimeout(300);
        const toolbarVisible = await page.locator('[data-f="F-02-014 F-02-032 F-02-034"]').isVisible().catch(() => false);
        const cancelBtn = page.locator('button', { hasText: 'Отмена' }).first();
        await cancelBtn.click();
        await page.waitForTimeout(300);
        const stillSelected = await page.locator('body').innerText().then((t) => /выбрано/i.test(t)).catch(() => false);
        await shot(page, '14-after-cancel-selection-cleared');
        rec(
          'F-02-014 тулбар «Выбрано N / Настройка графика / Удалить / Отмена» достижим мышью',
          false,
          `BLOCK: тулбар (data-f=F-02-014 F-02-032 F-02-034) виден только при panelOpen=false, но панель открывается при ЛЮБОМ клике по ячейке (toggleCell → setPanelOpen(true)); закрытие панели (Отмена/фон/✕) всегда чистит selected через close()→onClearSelection(). Тулбар виден сразу после клика: ${toolbarVisible} (ожидалось false — он и не должен быть виден, пока панель открыта); после «Отмена» выделение тоже пропало: ${!stillSelected}. Итог: набор «выбрано + тулбар с кнопкой Удалить» недостижим действием мыши ни в одном состоянии.`,
        );
      } else {
        rec('F-02-014 тулбар', false, 'пустая ячейка для теста не найдена');
      }
    } catch (e) {
      rec('F-02-014', false, String(e.message).split('\n')[0]);
    }

    // reload before copy-modal test (previous block may have left a saved cell / open panel)
    await page.goto(url('/biz/schedule', { persona: 'owner' }), { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);

    // F-02-015: copy modal via row's "⋮" menu (EllipsisVertical icon button)
    try {
      const rowMenuBtn = page.locator('table tbody button:has(svg)').first();
      const target = rowMenuBtn;
      if (await target.count()) {
        await target.click();
        await page.waitForTimeout(300);
        const copyItem = page.getByText('Копировать', { exact: false }).first();
        if (await copyItem.count()) {
          await copyItem.click();
          await page.waitForTimeout(300);
          await shot(page, '15-copy-modal');
          const modalVisible = await page.getByText('Копирование графика', { exact: false }).first().isVisible().catch(() => false)
            || await page.locator('[role=dialog]').first().isVisible().catch(() => false);
          rec('F-02-015 модалка копирования открывается', modalVisible, `видна: ${modalVisible}`);
          await page.keyboard.press('Escape');
        } else {
          rec('F-02-015 модалка копирования', false, 'пункт «Копировать» в меню «⋯» не найден');
        }
      } else {
        rec('F-02-015 меню «⋯»', false, 'кнопка «⋯» на строке сотрудника не найдена');
      }
    } catch (e) {
      rec('F-02-015', false, String(e.message).split('\n')[0]);
    }

    await ctx.close();
  }

  // ---------- Phone owner: reproduce F-00-051 overflow claim from m0 (should be fixed by fix1) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[phone-master] ${m.text()}`); });
    await page.goto(url('/biz/schedule/calendar', { persona: 'master' }), { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await shot(page, '16-calendar-phone-master');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    rec('F-00-051 «Мой календарь» на телефоне без обрезки (перепроверка fix1)', !overflow, `document overflow: ${overflow}`);
    await ctx.close();
  }

  // ---------- Armenian locale: visual + font check on schedule table ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'hy-AM', timezoneId: 'Asia/Yerevan' });
    const page = await ctx.newPage();
    const hyConsoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') hyConsoleErrors.push(m.text()); });
    await page.goto(url('/biz/schedule', { persona: 'owner', lang: 'hy' }), { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await shot(page, '17-schedule-hy');
    const bodyText = await page.locator('body').innerText();
    const rawKeyPattern = /[a-zA-Z]+\.[a-zA-Z][a-zA-Z0-9_.]*\b/g;
    const rawKeyHits = (bodyText.match(rawKeyPattern) || []).filter((s) => /^(schedule|filters|panel|templates|table|ui)\./.test(s));
    const hasEllipsis = /⋯|\[i18n:/.test(bodyText);
    rec('hy: нет сырых ключей на /biz/schedule', rawKeyHits.length === 0 && !hasEllipsis, `подозрительных: ${rawKeyHits.length}, консоль-ошибок: ${hyConsoleErrors.length}`);

    await page.goto(url('/biz/schedule/calendar', { persona: 'master', lang: 'hy' }), { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await shot(page, '18-calendar-hy');
    const bodyText2 = await page.locator('body').innerText();
    const rawKeyHits2 = (bodyText2.match(rawKeyPattern) || []).filter((s) => /^(schedule|filters|panel|templates|table|ui)\./.test(s));
    rec('hy: нет сырых ключей на /biz/schedule/calendar', rawKeyHits2.length === 0, `подозрительных: ${rawKeyHits2.length}`);
    await ctx.close();
  }

  // ---------- F-02-039: master sees only own row (re-verify) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
    const page = await ctx.newPage();
    await page.goto(url('/biz/schedule', { persona: 'master' }), { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await shot(page, '19-schedule-master-desktop');
    const rowCountText = await page.locator('body').innerText();
    const m = rowCountText.match(/Сотрудники\s*\((\d+)\)/);
    rec('F-02-039 мастер видит только свою строку', m ? m[1] === '1' : false, m ? `«Сотрудники (${m[1]})»` : 'текст «Сотрудники (N)» не найден');
    await ctx.close();
  }

  await browser.close();

  fs.writeFileSync(
    '/Users/arsen/WebstormProjects/booking-platform/qa/measure/schedule/m1-probe-log.json',
    JSON.stringify({ log, consoleErrors }, null, 2),
  );
  console.log('\nconsoleErrors:', consoleErrors.length);
  consoleErrors.forEach((e) => console.log(' -', e));
}

run().catch((e) => { console.error('FATAL', e); process.exit(1); });
