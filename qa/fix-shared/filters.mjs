// Проверка общего FilterBar и ссылок в строках таблиц на /biz/finance (операции): снимки + поведение.
//   node qa/fix-shared/filters.mjs [base=http://localhost:3710]
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const base = process.argv[2] ?? 'http://localhost:3710';
const out = 'docs/design/after';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
try {
  // ── Компьютер 1440
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/biz/finance?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  log('url', page.url());
  const trigger = page.getByRole('button', { name: /^Фильтры/ }).first();
  await trigger.waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${out}/fix-finance-1440.png` });

  // Ссылка-дата в строке: без подчёркивания, при наведении — с подчёркиванием
  const link = page.locator('table a').first();
  const deco = () => link.evaluate((a) => getComputedStyle(a).textDecorationLine);
  log('link decoration idle:', await deco());
  await link.hover();
  log('link decoration hover:', await deco());
  await page.mouse.move(5, 5);

  await trigger.click();
  const panel = page.getByRole('dialog', { name: 'Фильтры' });
  await panel.waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/fix-finance-1440-open.png` });
  // Вложенный Select: «Все кассы» → первая касса; панель должна остаться открытой
  await panel.getByRole('combobox').first().click().catch(async () => panel.locator('button[aria-haspopup="listbox"]').first().click());
  await page.waitForTimeout(400);
  const opt = page.getByRole('option').nth(1);
  const optText = await opt.textContent();
  await opt.click();
  await page.waitForTimeout(400);
  log('picked', optText, '→ panel still open:', await panel.isVisible());
  await panel.getByRole('button', { name: 'Показать' }).click();
  await page.waitForTimeout(500);
  const chips = page.getByRole('group', { name: 'Включённые фильтры' });
  log('chips:', (await chips.textContent())?.replace(/\s+/g, ' '), '| trigger:', await trigger.getAttribute('aria-label'));
  await page.screenshot({ path: `${out}/fix-finance-1440-chips.png` });
  await chips.getByRole('button', { name: /^Убрать фильтр/ }).first().click();
  await page.waitForTimeout(400);
  log('after ×: chips visible', await chips.isVisible().catch(() => false), '| trigger:', await trigger.getAttribute('aria-label'));

  // Esc закрывает панель
  await trigger.click();
  await panel.waitFor();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  log('esc closes:', !(await panel.isVisible()));
  log('errors', errors.slice(0, 3));
  await ctx.close();

  // ── Телефон 390
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await pctx.newPage();
  await p.goto(`${base}/biz/finance?demo=owner&lang=ru`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}/fix-finance-390.png` });
  await p.getByRole('button', { name: /^Фильтры/ }).first().click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${out}/fix-finance-390-open.png` });
  await pctx.close();
} finally {
  await browser.close();
  release();
}
