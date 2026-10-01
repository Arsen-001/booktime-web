import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', (m)=>{ if(m.type()==='error') console.log('CONSOLE ERR', m.text()); });
await page.goto('http://localhost:3710/biz/loyalty/card-types/new?demo=owner', { waitUntil: 'networkidle' });
await page.fill('input[placeholder="Например, «Карта постоянного клиента»"]', 'Автовыпуск-проверка g2-1');
await page.getByText('Выдавать в любой локации').click();
await page.waitForTimeout(200);
const saveBtn = page.getByRole('button', { name: /Сохранить/ }).first();
await saveBtn.click({ timeout: 8000 });
await page.waitForTimeout(1000);
console.log('saved, url:', page.url());

// create a new client via clients module (read-only usage, not editing code)
await page.goto('http://localhost:3710/biz/clients?demo=owner', { waitUntil: 'networkidle' });
const addBtn = page.getByRole('button', { name: /Добавить|Новый клиент|\+/ }).first();
console.log('add button count', await page.getByRole('button').allTextContents());
await browser.close();
await release();
