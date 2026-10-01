import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const cardTypeName = 'Автовыпуск-g2-1-7';
const clientName = 'Тест Автовыпуск G217';

await page.goto('http://localhost:3710/biz/loyalty/card-types/new?demo=owner', { waitUntil: 'networkidle' });
await page.fill('input[placeholder="Например, «Карта постоянного клиента»"]', cardTypeName);
await page.getByText('Выдавать в любой локации').click();
await page.getByRole('button', { name: /Сохранить/ }).first().click({ timeout: 8000 });
await page.waitForTimeout(800);

await page.goto('http://localhost:3710/biz/clients?demo=owner', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Добавить клиента' }).click();
await page.waitForTimeout(400);
await page.locator('input').nth(-2).fill(clientName);
await page.locator('input').nth(-1).fill('55111777');
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Добавить', exact: true }).click({ timeout: 8000 });
await page.waitForTimeout(1200);

// find newly created client in list and click it directly (same page, same session)
const searchInput = page.locator('input').first();
await searchInput.fill(clientName);
await page.waitForTimeout(600);
await page.screenshot({ path: 'qa/shots/loyalty-g2-1/search-result.png' });
const row = page.getByText(clientName).first();
await row.click({ timeout: 8000 });
await page.waitForTimeout(800);
console.log('client detail url', page.url());
await page.screenshot({ path: 'qa/shots/loyalty-g2-1/client-detail2.png', fullPage: true });
await browser.close();
await release();
