// ux-r5: пустой список через фильтр «Уволенные» (десктоп)
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ru-RU', timezoneId: 'Asia/Yerevan' });
const page = await ctx.newPage();
await page.goto('http://localhost:3710/biz/schedule?demo=owner&sphere=nails&lang=ru&theme=light', { waitUntil: 'load', timeout: 180000 });
await page.locator('table').first().waitFor({ timeout: 120000 });
await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
await page.getByRole('combobox').filter({ hasText: 'Неуволенные' }).first().click();
await page.getByRole('option', { name: 'Уволенные', exact: true }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: 'qa/measure/schedule/ux-r5-shots/flows/d14b-filter-fired-empty.png' });
// вернуть как было
await page.getByRole('button', { name: /Сбросить/ }).first().click().catch(() => {});
await page.waitForTimeout(1500);
await b.close();
