import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', (e)=>console.log('PAGE ERR', e.message));

const cardTypeName = 'Автовыпуск-g2-1-5';
const clientName = 'Тест Автовыпуск G215';

await page.goto('http://localhost:3710/biz/loyalty/card-types/new?demo=owner', { waitUntil: 'networkidle' });
await page.fill('input[placeholder="Например, «Карта постоянного клиента»"]', cardTypeName);
await page.getByText('Выдавать в любой локации').click();
await page.getByRole('button', { name: /Сохранить/ }).first().click({ timeout: 8000 });
await page.waitForTimeout(800);

await page.goto('http://localhost:3710/biz/clients?demo=owner', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Добавить клиента' }).click();
await page.waitForTimeout(400);
await page.fill('input[value=""]', '').catch(()=>{});
await page.locator('input').nth(-2).fill(clientName);
await page.locator('input').nth(-1).fill('55111888');
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Добавить', exact: true }).click({ timeout: 8000 });
await page.waitForTimeout(1200);
console.log('url after add client', page.url());

await page.goto('http://localhost:3710/biz/clients?demo=owner', { waitUntil: 'networkidle' });
await page.fill('input[placeholder="Имя, телефон, email или номер карты"]', clientName).catch(async ()=>{
  const search = page.locator('input').first();
  await search.fill(clientName);
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'qa/shots/loyalty-g2-1/clients-search.png' });
const link = page.getByText(clientName).first();
await link.click({ timeout: 8000 });
await page.waitForTimeout(700);
console.log('client detail url', page.url());
const loyaltyTab = page.getByText('Лояльность', { exact: true });
if (await loyaltyTab.count()) { await loyaltyTab.first().click(); await page.waitForTimeout(500); }
const bodyText = await page.textContent('body');
console.log('Contains new card type name on client page?', bodyText.includes(cardTypeName));
await page.screenshot({ path: 'qa/shots/loyalty-g2-1/client-loyalty-tab.png', fullPage: true });
await browser.close();
await release();
