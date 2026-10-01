import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('console', (m)=>{ if(m.type()==='error') console.log('CONSOLE ERR', m.text()); });
page.on('pageerror', (e)=>console.log('PAGE ERR', e.message));

await page.goto('http://localhost:3710/biz/loyalty/card-types/new?demo=owner', { waitUntil: 'networkidle' });
await page.fill('input[placeholder="Например, «Карта постоянного клиента»"]', 'Автовыпуск-g2-1-2');
await page.getByText('Выдавать в любой локации').click();
await page.getByRole('button', { name: /Сохранить/ }).first().click({ timeout: 8000 });
await page.waitForTimeout(800);

await page.goto('http://localhost:3710/biz/clients?demo=owner', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Добавить клиента' }).click();
await page.waitForTimeout(500);
// try to find name/phone inputs in a modal
const inputs = await page.locator('input').all();
console.log('input count in modal context', inputs.length);
for (const inp of inputs) {
  const ph = await inp.getAttribute('placeholder');
  console.log('input placeholder:', ph);
}
await browser.close();
await release();
