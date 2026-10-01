import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', (e)=>console.log('PAGE ERR', e.message));
page.on('console', (m)=>{ if(m.type()==='error') console.log('CONSOLE ERR', m.text()); });

await page.goto('http://localhost:3710/biz/loyalty/card-types/new?demo=owner', { waitUntil: 'networkidle' });
await page.fill('input[placeholder="Например, «Карта постоянного клиента»"]', 'Автовыпуск-g2-1-4');
await page.getByText('Выдавать в любой локации').click();
await page.getByRole('button', { name: /Сохранить/ }).first().click({ timeout: 8000 });
await page.waitForTimeout(800);

await page.goto('http://localhost:3710/biz/clients?demo=owner', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Добавить клиента' }).click();
await page.waitForTimeout(500);
await page.fill('input[placeholder="Как зовут клиента"]', 'Тест Автовыпуск G214');
await page.fill('input[placeholder="Номер телефона"]', '+374 55 111299');
await page.waitForTimeout(200);
await page.screenshot({ path: 'qa/shots/loyalty-g2-1/new-client-modal.png' });
const buttons = await page.getByRole('button').allTextContents();
console.log('buttons in modal:', buttons);
await browser.close();
await release();
