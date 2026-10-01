// Дизайн-ревью schedule, заход ux-r5: снимки главных сценариев (телефон + десктоп, ru).
// node qa/scenarios/schedule/_ux-r5.mjs [phone|desktop]  → qa/measure/schedule/ux-r5-shots/flows/
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/measure/schedule/ux-r5-shots/flows';
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv[2];
const log = [];
const DEV = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const browser = await chromium.launch();

async function open(device, route, { persona = 'owner', query = '', waitH1 = true } = {}) {
  const ctx = await browser.newContext({ ...DEV[device], locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  const url = `${BASE}${route}${route.includes('?') ? '&' : '?'}demo=${persona}&sphere=nails&lang=ru&theme=light${query ? '&' + query : ''}`;
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 180000 });
      if (waitH1) await page.locator('main h1, h1').first().waitFor({ state: 'visible', timeout: 90000 });
      break;
    } catch (e) { log.push(`retry ${route} ${device}: ${String(e).split('\n')[0]}`); }
  }
  await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' }).catch(() => {});
  await page.waitForTimeout(2500);
  return { ctx, page };
}

async function shot(name, page, fn = async () => {}, { full = false } = {}) {
  try {
    await fn();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
    const m = await page.evaluate(() => ({ iw: innerWidth, vw: visualViewport?.width, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
    log.push(`ok   ${name} ${JSON.stringify(m)}`);
  } catch (e) {
    log.push(`FAIL ${name}: ${String(e).split('\n')[0]}`);
    await page.screenshot({ path: `${OUT}/${name}__fail.png` }).catch(() => {});
  }
}
const esc = async (page) => { await page.keyboard.press('Escape'); await page.waitForTimeout(500); };
const grid = (page) => page.locator('table[aria-label="Таблица графика"]');
const workCell = (page, n = 0) => grid(page).locator('tbody td button:has(span.bg-success-soft)').nth(n);
const pickOption = async (page, scope, idx, name) => {
  await scope.getByRole('combobox').nth(idx).click();
  await page.waitForTimeout(300);
  await page.getByRole('option', { name }).first().click();
};

async function run(device) {
  const p = device === 'phone' ? 'p' : 'd';
  {
    const { ctx, page } = await open(device, '/biz/schedule');
    await shot(`${p}01-table`, page);
    await shot(`${p}01-table-full`, page, async () => {}, { full: true });
    await shot(`${p}02-cell-panel`, page, () => workCell(page, 0).click());
    await shot(`${p}02b-panel-full`, page, async () => {}, { full: true });
    const dlg = page.getByRole('dialog').last();
    await shot(`${p}03-panel-weekdays`, page, () => pickOption(page, dlg, 0, 'По дням недели'));
    await shot(`${p}04-panel-shifts`, page, () => pickOption(page, dlg, 0, 'По сменам'));
    await shot(`${p}05-panel-notworking`, page, async () => {
      await pickOption(page, dlg, 0, 'Без шаблона');
      await pickOption(page, dlg, 1, 'Нерабочий день');
    });
    await shot(`${p}06-save-work`, page, async () => {
      await pickOption(page, dlg, 1, 'Рабочий день');
      await dlg.getByRole('button', { name: 'Сохранить' }).click();
      await page.waitForTimeout(1500);
    });
    await esc(page);
    await shot(`${p}07-multi-select`, page, async () => {
      await esc(page);
      await workCell(page, 1).click();
      await page.waitForTimeout(400);
      await esc(page);
    });
    await page.reload({ waitUntil: 'load' });
    await page.locator('h1').first().waitFor();
    await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' }).catch(() => {});
    await page.waitForTimeout(2500);
    await shot(`${p}08-row-menu`, page, () => page.getByRole('button', { name: 'Действия с сотрудником' }).first().click());
    await shot(`${p}09-copy-modal`, page, () => page.getByRole('menuitem', { name: 'Скопировать график' }).first().click());
    await esc(page);
    await shot(`${p}10-filters`, page, async () => {
      const f = page.getByRole('button', { name: /^Фильтры/ }).first();
      if (await f.isVisible().catch(() => false)) await f.click();
      else await page.getByRole('button', { name: /Должность/ }).first().click();
    });
    await esc(page);
    await shot(`${p}11-view-menu`, page, () => page.getByRole('button', { name: 'Настройка вида' }).first().click());
    await esc(page);
    await shot(`${p}12-quick-access`, page, () => page.getByRole('button', { name: 'Показать' }).first().click(), { full: true });
    await shot(`${p}13-month`, page, () => page.getByRole('radio', { name: 'Месяц' }).or(page.getByRole('button', { name: 'Месяц' })).or(page.getByRole('tab', { name: 'Месяц' })).first().click());
    await ctx.close();
  }
  {
    const { ctx, page } = await open(device, '/biz/schedule');
    await shot(`${p}14-filter-fired-empty`, page, async () => {
      const f = page.getByRole('button', { name: /^Фильтры/ }).first();
      const scope = (await f.isVisible().catch(() => false)) ? (await f.click(), page.getByRole('dialog').last()) : page.locator('main');
      await page.waitForTimeout(400);
      const cb = scope.getByRole('combobox').filter({ hasText: 'Неуволенные' }).first();
      await cb.click();
      await page.getByRole('option', { name: 'Уволенные' }).first().click();
      await page.waitForTimeout(800);
      await esc(page);
      await page.waitForTimeout(1200);
    });
    await page.getByRole('button', { name: /Сбросить/ }).first().click().catch(() => {});
    await ctx.close();
  }
  { const { ctx, page } = await open(device, '/biz/schedule', { query: 'api=error', waitH1: false }); await page.waitForTimeout(3000); await shot(`${p}15-error`, page); await ctx.close(); }
  {
    const { ctx, page } = await open(device, '/biz/schedule', { query: 'api=slow', waitH1: false });
    await page.waitForTimeout(200);
    await shot(`${p}16-slow`, page);
    await ctx.close();
  }
  { const { ctx, page } = await open(device, '/biz/schedule', { persona: 'master' }); await shot(`${p}17-master-table`, page); await ctx.close(); }
  // Мой календарь
  {
    const { ctx, page } = await open(device, '/biz/schedule/calendar');
    await shot(`${p}20-calendar-owner-nostaff`, page);
    await shot(`${p}21-calendar-owner-picked`, page, async () => {
      await page.locator('main').getByRole('combobox').first().click();
      await page.getByRole('option').nth(1).click();
      await page.waitForURL(/staff=/);
      await page.locator('h1').first().waitFor();
      await page.waitForTimeout(3000);
    });
    await ctx.close();
  }
  {
    const { ctx, page } = await open(device, '/biz/schedule/calendar', { persona: 'master' });
    await shot(`${p}22-calendar-master`, page);
    await shot(`${p}22b-calendar-master-full`, page, async () => {}, { full: true });
    await shot(`${p}23-quick-booking`, page, () => page.getByRole('button', { name: '+ запись' }).first().click());
    await esc(page);
    await ctx.close();
  }
  { const { ctx, page } = await open(device, '/biz/schedule/calendar', { persona: 'master', query: 'api=error', waitH1: false }); await page.waitForTimeout(3000); await shot(`${p}24-calendar-error`, page); await ctx.close(); }
  // Шаблоны
  {
    const { ctx, page } = await open(device, '/biz/schedule/templates');
    await shot(`${p}30-templates`, page);
    await shot(`${p}31-template-create`, page, () => page.getByRole('button', { name: /Создать шаблон/ }).first().click());
    await ctx.close();
  }
  { const { ctx, page } = await open(device, '/biz/schedule/templates', { query: 'api=error', waitH1: false }); await page.waitForTimeout(3000); await shot(`${p}32-templates-error`, page); await ctx.close(); }
  // Доступное время
  {
    const { ctx, page } = await open(device, '/biz/schedule/slots');
    await shot(`${p}40-slots`, page);
    await shot(`${p}40b-slots-full`, page, async () => {}, { full: true });
    await shot(`${p}41-slots-wizard`, page, () => page.getByRole('button', { name: /Редактировать правила/ }).first().click());
    await esc(page);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(device, '/biz/schedule/slots', { persona: 'master' });
    await shot(`${p}42-slots-master`, page);
    await ctx.close();
  }
  { const { ctx, page } = await open(device, '/biz/schedule/slots', { query: 'api=error', waitH1: false }); await page.waitForTimeout(3000); await shot(`${p}43-slots-error`, page); await ctx.close(); }
  // Повторы
  {
    const { ctx, page } = await open(device, '/biz/schedule/series');
    await shot(`${p}50-series`, page);
    await shot(`${p}50b-series-full`, page, async () => {}, { full: true });
    await shot(`${p}51-series-new`, page, () => page.getByRole('button', { name: /Новая серия/ }).first().click());
    await ctx.close();
  }
  { const { ctx, page } = await open(device, '/biz/schedule/series', { query: 'api=error', waitH1: false }); await page.waitForTimeout(3000); await shot(`${p}52-series-error`, page); await ctx.close(); }
  // История
  {
    const { ctx, page } = await open(device, '/biz/schedule/history');
    await shot(`${p}60-history`, page);
    await ctx.close();
  }
  { const { ctx, page } = await open(device, '/biz/schedule/history', { persona: 'master' }); await shot(`${p}61-history-master`, page); await ctx.close(); }
  // Вклады
  { const { ctx, page } = await open(device, '/dev/ext/staffCard/schedule', { waitH1: false }); await page.waitForTimeout(4000); await shot(`${p}70-ext-staffcard`, page, async () => {}, { full: true }); await ctx.close(); }
  { const { ctx, page } = await open(device, '/dev/ext/settingsHub/schedule', { waitH1: false }); await page.waitForTimeout(4000); await shot(`${p}71-ext-settings`, page, async () => {}, { full: true }); await ctx.close(); }
  // Соседи для сверки
  { const { ctx, page } = await open(device, '/biz/journal'); await shot(`${p}90-compare-journal`, page); await ctx.close(); }
}

for (const d of only ? [only] : ['desktop', 'phone']) {
  await run(d);
  fs.writeFileSync(`${OUT}/log-${d}.txt`, log.join('\n'));
}
await browser.close();
console.log(log.join('\n'));
