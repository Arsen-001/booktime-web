// Дизайн-ревью schedule, заход ux-r2: снимки главных сценариев (телефон + десктоп, ru).
// node qa/scenarios/schedule/_ux-r2.mjs [phone|desktop]  → qa/measure/schedule/ux-r2-shots/flows/
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3710';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/measure/schedule/ux-r2-shots/flows';
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
  page.setDefaultTimeout(60000);
  const url = `${BASE}${route}${route.includes('?') ? '&' : '?'}demo=${persona}&sphere=nails&lang=ru&theme=light${query ? '&' + query : ''}`;
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 180000 });
      if (waitH1) await page.locator('main h1, h1').first().waitFor({ state: 'visible', timeout: 120000 });
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
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
    log.push(`ok   ${name}`);
  } catch (e) {
    log.push(`FAIL ${name}: ${String(e).split('\n')[0]}`);
    await page.screenshot({ path: `${OUT}/${name}__fail.png` }).catch(() => {});
  }
}
const esc = async (page) => { await page.keyboard.press('Escape'); await page.waitForTimeout(500); };
const firstCell = (page) => page.locator('table[aria-label="Таблица графика"] tbody td button').first();
const workCell = (page, n = 0) => page.locator('table[aria-label="Таблица графика"] tbody td button:has(span.bg-success-soft)').nth(n);

async function run(device) {
  const p = device === 'phone' ? 'p' : 'd';
  // Главный экран, владелец
  {
    const { ctx, page } = await open(device, '/biz/schedule');
    await shot(`${p}01-table`, page);
    await shot(`${p}01-table-full`, page, async () => {}, { full: true });
    await shot(`${p}02-cell-panel`, page, () => workCell(page, 0).click());
    await shot(`${p}02b-panel-full`, page, async () => {}, { full: true });
    await shot(`${p}03-panel-weekdays`, page, () => page.getByRole('dialog').locator('select').first().selectOption('weekdays'));
    await shot(`${p}04-panel-shifts`, page, () => page.getByRole('dialog').locator('select').first().selectOption('shifts'));
    await shot(`${p}05-panel-notworking`, page, async () => {
      await page.getByRole('dialog').locator('select').first().selectOption('none');
      await page.getByRole('dialog').locator('select').nth(1).selectOption('not_working');
    });
    await shot(`${p}06-save-work`, page, async () => {
      await page.getByRole('dialog').locator('select').nth(1).selectOption('work');
      await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click();
      await page.waitForTimeout(1500);
    });
    await esc(page);
    await shot(`${p}07-multi-select`, page, async () => {
      await esc(page);
      await workCell(page, 1).click();
      await page.waitForTimeout(400);
      await workCell(page, 2).click().catch(() => {});
      await esc(page);
    });
    await esc(page);
    await shot(`${p}08-row-menu`, page, () => page.getByRole('button', { name: 'Действия с сотрудником' }).first().click());
    await shot(`${p}09-copy-modal`, page, () => page.getByText('Скопировать график').first().click());
    await esc(page);
    await shot(`${p}10-filter-position`, page, () => page.getByRole('button', { name: /Должность/ }).first().click());
    await esc(page);
    await shot(`${p}11-view-menu`, page, () => page.getByRole('button', { name: 'Настройка вида' }).first().click());
    await esc(page);
    await shot(`${p}12-month`, page, () => page.getByRole('radio', { name: 'Месяц' }).or(page.getByRole('button', { name: 'Месяц' })).or(page.getByRole('tab', { name: 'Месяц' })).first().click());
    await shot(`${p}13-filter-fired-empty`, page, async () => {
      const sel = page.locator('select').filter({ has: page.locator('option[value="only"]', { hasText: 'Уволенные' }) }).first();
      await sel.selectOption('only');
      await page.waitForTimeout(1500);
    });
    // вернуть фильтр
    await page.locator('select').filter({ has: page.locator('option', { hasText: 'Уволенные' }) }).first().selectOption('active').catch(() => {});
    await page.waitForTimeout(800);
    await ctx.close();
  }
  { const { ctx, page } = await open(device, '/biz/schedule', { query: 'api=error' }); await shot(`${p}14-error`, page); await ctx.close(); }
  {
    const { ctx, page } = await open(device, '/biz/schedule', { query: 'api=slow', waitH1: false });
    await page.waitForTimeout(500);
    await shot(`${p}15-slow`, page);
    await ctx.close();
  }
  // Мастер: своя строка
  { const { ctx, page } = await open(device, '/biz/schedule', { persona: 'master' }); await shot(`${p}16-master-table`, page); await ctx.close(); }
  // Мой календарь
  {
    const { ctx, page } = await open(device, '/biz/schedule/calendar');
    await shot(`${p}20-calendar-owner-nostaff`, page);
    await shot(`${p}21-calendar-owner-picked`, page, async () => {
      const sel = page.locator('main select').first();
      const val = await sel.locator('option').nth(1).getAttribute('value');
      await sel.selectOption(val);
      await page.locator('h1').first().waitFor();
      await page.waitForTimeout(3000);
    });
    await ctx.close();
  }
  {
    const { ctx, page } = await open(device, '/biz/schedule/calendar', { persona: 'master' });
    await shot(`${p}22-calendar-master`, page);
    await shot(`${p}22b-calendar-master-full`, page, async () => {}, { full: true });
    await shot(`${p}23-calendar-mode-busy`, page, () => page.getByRole('button', { name: /Всё занято/ }).click());
    await shot(`${p}23b-calendar-mode-busy-full`, page, async () => {}, { full: true });
    await page.getByRole('button', { name: /Всё свободно/ }).click().catch(() => {});
    await ctx.close();
  }
  { const { ctx, page } = await open(device, '/biz/schedule/calendar', { persona: 'master', query: 'api=error' }); await shot(`${p}24-calendar-error`, page); await ctx.close(); }
  // Шаблоны
  {
    const { ctx, page } = await open(device, '/biz/schedule/templates');
    await shot(`${p}30-templates`, page);
    await shot(`${p}31-template-create`, page, () => page.getByRole('button', { name: /Создать шаблон/ }).first().click());
    await shot(`${p}31b-template-create-full`, page, async () => {}, { full: true });
    await esc(page);
    await ctx.close();
  }
  { const { ctx, page } = await open(device, '/biz/schedule/templates', { query: 'api=error' }); await shot(`${p}32-templates-error`, page); await ctx.close(); }
  { const { ctx, page } = await open(device, '/biz/schedule/templates', { persona: 'master' }); await shot(`${p}33-templates-master`, page); await ctx.close(); }
  // Для сравнения — сосед
  { const { ctx, page } = await open(device, '/biz/journal'); await shot(`${p}90-compare-journal`, page); await ctx.close(); }
}

for (const d of only ? [only] : ['desktop', 'phone']) await run(d);
fs.writeFileSync(`${OUT}/log-${only ?? 'all'}.txt`, log.join('\n'));
console.log(log.join('\n'));
await browser.close();
