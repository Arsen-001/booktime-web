// Обход всех экранов с FilterBar: панель «Фильтры» открывается, выбор в первом списке даёт чип и счётчик,
// «×» у чипа и «Сбросить» убирают фильтры, ошибок страницы нет.
//   node qa/fix-shared/sweep.mjs [base=http://localhost:3710]
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../scripts/pw-slots.mjs';

const base = process.argv[2] ?? 'http://localhost:3710';
const routes = [
  '/biz/records', '/biz/network/records', '/biz/billing/invoices', '/biz/settings/history', '/biz/notifications/log',
  '/biz/notifications/channels/catalog', '/biz/schedule', '/platform/businesses?demo=platform', '/platform/visits?demo=platform',
  '/platform/support?demo=platform', '/biz/loyalty/deposits', '/biz/finance/accounts', '/biz/loyalty/deposits/operations',
  '/biz/loyalty/cards', '/biz/loyalty/certificates', '/biz/loyalty/online-sales/orders', '/biz/loyalty/transactions',
  '/biz/loyalty/memberships', '/biz/loyalty/purchase-requests', '/biz/finance', '/biz/stock/operations',
  '/biz/finance/counterparties', '/biz/finance/documents', '/biz/services/documents', '/biz/staff/log', '/biz/stock',
  '/biz/stock/settings/access', '/biz/stock/tech-cards', '/biz/stock/clients', '/search?demo=client',
];
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const rows = [];
try {
  for (const r of routes) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
    const url = `${base}${r}${r.includes('?') ? '&' : '?'}${r.includes('demo=') ? '' : 'demo=owner&'}lang=ru`;
    const row = { route: r };
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
      await page.waitForTimeout(1200);
      const trigger = page.locator('main button[aria-haspopup="dialog"]', { hasText: 'Фильтры' }).first();
      row.pills = await page.locator('main .flex.flex-wrap.items-center.gap-2').first().locator('> *').count().catch(() => -1);
      if (!(await trigger.count())) {
        row.panel = 'нет (только поиск/действия)';
      } else {
        row.initial = await trigger.getAttribute('aria-label');
        await trigger.click();
        const panel = page.getByRole('dialog', { name: 'Фильтры' });
        await panel.waitFor({ timeout: 5000 });
        row.fields = await panel.locator(':scope > div > div > span.text-sm').count();
        const combo = panel.locator('button[aria-haspopup="listbox"], [role="combobox"]').first();
        if (await combo.count()) {
          await combo.click();
          await page.waitForTimeout(300);
          const opts = page.getByRole('option');
          const n = await opts.count();
          if (n > 1) {
            // Любой вариант, кроме выбранного сейчас
            let idx = 1;
            for (let i = 0; i < n; i++) if ((await opts.nth(i).getAttribute('aria-selected')) !== 'true') { idx = i; break; }
            await opts.nth(idx).click();
          } else await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          row.stillOpen = await panel.isVisible();
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        row.trigger = await trigger.getAttribute('aria-label');
        const chips = page.getByRole('group', { name: 'Включённые фильтры' });
        row.chips = (await chips.count()) ? (await chips.locator('[aria-label^="Убрать фильтр"]').count()) : 0;
        if (row.chips) {
          await chips.locator('[aria-label^="Убрать фильтр"]').first().click();
          await page.waitForTimeout(400);
          row.afterX = await trigger.getAttribute('aria-label');
        }
      }
    } catch (e) {
      row.fail = String(e).split('\n')[0].slice(0, 140);
    }
    row.errors = errors.length;
    rows.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
} finally {
  await browser.close();
  release();
}
