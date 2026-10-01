// b05-m0: проверка прав "Цифрового журнала" (F-01-085/115/154/178/179/180) и F-01-219 (записи удалённого клиента).
// Реальные действия в браузере поверх localStorage-мока. Пишет отчёт в JSON.
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';
import fs from 'node:fs';

const BASE = 'http://localhost:3710';
const out = { steps: [], consoleErrors: [] };
const log = (name, ok, detail) => { out.steps.push({ name, ok, detail }); console.log((ok ? '✅' : '❌'), name, detail ?? ''); };

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') out.consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => out.consoleErrors.push('pageerror: ' + e.message));

  // ── персона admin, чтобы получить редактируемые тонкие права по сотруднику ──
  await page.goto(`${BASE}/biz/journal/settings?demo=admin&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Открыть блок прав, выбрать вкладку "Журнал записей"
  const rightsBlock = page.locator('[data-f*="F-01-178"]');
  await rightsBlock.scrollIntoViewIfNeeded();
  log('F-01-168/178/179 блок прав виден на /biz/journal/settings', await rightsBlock.count() > 0);

  // Выключить "Показывать номера телефонов" (journal block)
  const phoneSwitchLabel = page.locator('[data-f*="F-01-178"] label:has-text("телефон"), [data-f*="F-01-178"] :text("Показывать номера телефонов")').first();
  const journalTab = page.getByRole('tab', { name: /Журнал записей/i }).first();
  if (await journalTab.count()) await journalTab.click();
  await page.waitForTimeout(300);

  // Найти переключатель "Показывать номера телефонов" в журнальном блоке (первое совпадение внутри rightsBlock)
  const showPhonesSwitch = rightsBlock.getByText('Показывать номера телефонов', { exact: false }).first();
  const showPhonesRow = showPhonesSwitch.locator('xpath=ancestor::*[self::button or @role="switch"][1]');
  log('нашли переключатель "Показывать номера телефонов"', await showPhonesSwitch.count() > 0);

  // Клик по самому свитчу (ищем ближайший button[role=switch] в той же строке)
  const swLocator = rightsBlock.locator('button[role="switch"]').filter({ hasText: '' });
  // Свитчи не содержат текст сами — берём по соседству: находим все label-строки и их свитчи по порядку
  const journalSwitchLabels = await rightsBlock.locator('label, p, span').allTextContents();
  fs.writeFileSync('/tmp/b05-journal-labels.json', JSON.stringify(journalSwitchLabels, null, 2));

  await page.screenshot({ path: 'qa/shots/journal/b05-rights-journal-tab.png', fullPage: true });

  const windowTab = page.getByRole('tab', { name: /Окно записи/i }).first();
  if (await windowTab.count()) await windowTab.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'qa/shots/journal/b05-rights-window-tab.png', fullPage: true });

  await ctx.close();
} catch (e) {
  out.error = String(e);
} finally {
  await browser.close();
  release();
  fs.mkdirSync('qa/shots/journal', { recursive: true });
  fs.writeFileSync('qa/measure/journal/b05-probe-report.json', JSON.stringify(out, null, 2));
  console.log('done');
}
