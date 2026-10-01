// Догон g3-1-m2: точные проверки F-01-006 (переключатель филиала) и F-01-013 (недельный вид),
// плюс F-01-037 (плитки после реального сохранения) с достаточным ожиданием.
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const OUT = 'qa/shots/journal-g3-1-m2/probe2';
fs.mkdirSync(OUT, { recursive: true });
const log = [];
const note = (id, msg) => { log.push(`${id}: ${msg}`); console.log(id, '::', msg); };
const f = (id) => `[data-f~="${id}"]`;
const shot = async (page, name) => page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  // ---- F-01-006: переключатель локации у network, точный Select ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/biz/journal?demo=network&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const staffBefore = (await page.locator('[data-f~="F-01-019"] h3, [data-f~="F-01-019"] [class*=name]').allInnerTexts().catch(() => []));
    const staffHeadingsBefore = await page.locator('text=/Стилист-парикмахер|Колорист|Косметолог|Парикмахер|Мастер маникюра|Мастер педикюра|Нейл-дизайнер/').allInnerTexts().catch(() => []);
    note('F-01-006', `сотрудники ДО (по должностям): ${JSON.stringify(staffHeadingsBefore)}`);
    await shot(page, '01-before');

    const select = page.getByRole('combobox').first();
    const selCount = await select.count();
    note('F-01-006', `Select-переключатель локации найден: ${selCount > 0}`);
    if (selCount) {
      const beforeLabel = await select.innerText().catch(() => '');
      await select.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      await shot(page, '02-open');
      const options = await page.locator('[role="option"]').allInnerTexts().catch(() => []);
      note('F-01-006', `опции меню локации: ${JSON.stringify(options)}; текущая метка была "${beforeLabel}"`);
      const specific = page.locator('[role="option"]').filter({ hasText: /Шенгавит|Нор.?Норк/i }).first();
      if (await specific.count()) {
        const pickedText = await specific.innerText();
        await specific.click({ force: true }).catch(() => {});
        await page.waitForTimeout(900);
        await shot(page, '03-after-switch');
        const staffHeadingsAfter = await page.locator('text=/Стилист-парикмахер|Колорист|Косметолог|Парикмахер|Мастер маникюра|Мастер педикюра|Нейл-дизайнер/').allInnerTexts().catch(() => []);
        note('F-01-006', `выбрано "${pickedText}"; сотрудники ПОСЛЕ: ${JSON.stringify(staffHeadingsAfter)} (ожидание: набор изменился)`);
      } else {
        note('F-01-006', 'конкретный филиал (Шенгавит/Нор-Норк) не найден среди опций');
      }
    }
    await ctx.close();
  }

  // ---- F-01-013: недельный вид с точным кликом по опции ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const toggle = page.getByRole('combobox').filter({ hasText: /День|Неделя/i }).first();
    const toggleAlt = page.locator('button, [role=combobox]').filter({ hasText: /^День/ }).first();
    const target = (await toggle.count()) ? toggle : toggleAlt;
    note('F-01-013', `переключатель День/Неделя найден: ${await target.count() > 0}`);
    if (await target.count()) {
      await target.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      await shot(page, '10-toggle-open');
      const opt = page.locator('[role="option"]').filter({ hasText: /^Неделя$/ }).first();
      note('F-01-013', `опция «Неделя» найдена в списке: ${await opt.count() > 0}`);
      if (await opt.count()) {
        await opt.click({ force: true }).catch(() => {});
        await page.waitForTimeout(900);
        await shot(page, '11-week-selected');
        const dayCols = await page.locator('[data-f~="F-01-013"]').count();
        note('F-01-013', `data-f=F-01-013 узлов на экране после выбора «Неделя»: ${dayCols}`);
        const headerTexts = await page.locator('thead th, [role=columnheader], header').allInnerTexts().catch(() => []);
        note('F-01-013', `заголовки: ${JSON.stringify(headerTexts.slice(0, 10))}`);
        const grayNonWorking = await page.locator('[data-nonworking], .bg-muted, [class*="gray"]').count();
        note('F-01-013', `элементов с признаком «нерабочий/серый»: ${grayNonWorking}`);
      }
    }
    await ctx.close();
  }

  // ---- F-01-037: плитки после реального сохранения (долгое ожидание) ----
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/biz/journal?demo=owner&sphere=nails&lang=ru&theme=light`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const cells = page.locator(f('F-01-024'));
    const n = await cells.count();
    if (n > 3) {
      const box = await cells.nth(3).boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + 40);
        await page.waitForTimeout(700);
      }
    }
    const phoneInput = page.locator('input[type="tel"], input[name*="phone" i]').first();
    if (await phoneInput.count()) await phoneInput.fill('93777888').catch(() => {});
    const saveBtn = page.getByRole('button', { name: /Записать|Сохранить/i }).first();
    if (await saveBtn.count()) {
      await saveBtn.click({ force: true }).catch(() => {});
      // ждём исчезновения спиннера/кнопки "Записать" в состоянии загрузки — до 4с
      await page.waitForTimeout(2500);
      const stillLoading = await page.locator('button[aria-busy="true"]').count();
      note('F-01-037', `после 2.5с всё ещё в состоянии загрузки: ${stillLoading > 0}`);
      const outOfSchedule = await page.locator('text=/Вне графика|занят/i').count();
      if (outOfSchedule) {
        await shot(page, '20-warn');
        const yes = page.getByRole('button', { name: /^Да$/i }).first();
        if (await yes.count()) { await yes.click({ force: true }).catch(() => {}); await page.waitForTimeout(1500); }
      }
    }
    await page.waitForTimeout(500);
    await shot(page, '21-after-save-settled');
    const advanced = await page.locator('text=/Списание расходников|История изменений/i').count();
    note('F-01-037', `плитки «Списание/История» видны у сохранённой записи: ${advanced > 0}`);
    await ctx.close();
  }

  fs.writeFileSync(`${OUT}/log.txt`, log.join('\n'));
  console.log('DONE');
} catch (e) {
  console.log('FATAL', e.message);
  fs.writeFileSync(`${OUT}/log.txt`, log.join('\n') + '\nFATAL: ' + e.message);
} finally {
  await browser.close();
  release();
}
