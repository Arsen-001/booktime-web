import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', (e)=>console.log('PAGE ERR', e.message));

await page.goto('http://localhost:3710/biz/loyalty/card-types/new?demo=owner', { waitUntil: 'networkidle' });
await page.fill('input[placeholder="Например, «Карта постоянного клиента»"]', 'Автовыпуск-g2-1-3');
await page.getByText('Выдавать в любой локации').click();
await page.getByRole('button', { name: /Сохранить/ }).first().click({ timeout: 8000 });
await page.waitForTimeout(800);

await page.goto('http://localhost:3710/biz/clients?demo=owner', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Добавить клиента' }).click();
await page.waitForTimeout(500);
await page.fill('input[placeholder="Как зовут клиента"]', 'Тест Автовыпуск G21');
await page.fill('input[placeholder="Номер телефона"]', '+374 55 111222');
await page.waitForTimeout(200);
const saveBtn = page.getByRole('button', { name: /Сохранить|Добавить/ }).last();
await saveBtn.click({ timeout: 8000 }).catch(e=>console.log('save err', e.message));
await page.waitForTimeout(1200);
console.log('url after save client', page.url());
// find the client and open card
await page.goto('http://localhost:3710/biz/clients?demo=owner', { waitUntil: 'networkidle' });
await page.getByText('Тест Автовыпуск G21').first().click({ timeout: 8000 }).catch(e=>console.log('click client err', e.message));
await page.waitForTimeout(800);
console.log('client page url', page.url());
const bodyText = await page.textContent('body');
console.log('Contains new card type name?', bodyText.includes('Автовыпуск-g2-1-3'));
await page.screenshot({ path: 'qa/shots/loyalty-g2-1/auto-issue-client-card.png', fullPage: true });
await browser.close();
await release();
