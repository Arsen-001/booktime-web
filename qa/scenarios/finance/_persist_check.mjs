import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const allLogs = [];
page.on('console', m => allLogs.push(m.type()+': '+m.text()));

await page.goto('http://localhost:3710/biz/finance/settlements?demo=owner&lang=ru');
await page.waitForTimeout(800);
await page.getByText('Выписать премию', { exact: false }).click();
await page.waitForTimeout(400);
await page.locator('input[placeholder*="результат"]').fill('Проверка сохранения');
await page.locator('input[placeholder="0"]').fill('77');
await page.getByRole('button', { name: 'Сохранить' }).click();
await page.waitForTimeout(3000);
console.log('toast visible:', await page.locator('text=Начисление').count());
console.log('ALL CONSOLE:', JSON.stringify(allLogs.filter(l=>l.toLowerCase().includes('mock-db')||l.toLowerCase().includes('quota')||l.toLowerCase().includes('storage'))));
console.log('entry in list:', (await page.textContent('body')).includes('Проверка сохранения'));

const lsKeys = await page.evaluate(() => Object.keys(localStorage));
console.log('localStorage keys:', lsKeys);
const dbKey = lsKeys.find(k => k.toLowerCase().includes('db') || k.toLowerCase().includes('mock'));
console.log('dbKey guess:', dbKey);
if (dbKey) {
  const raw = await page.evaluate((k) => localStorage.getItem(k), dbKey);
  console.log('has settlementEntries in storage:', raw.includes('Проверка сохранения'));
}

console.log('--- reload ---');
await page.reload();
await page.waitForTimeout(1000);
const bodyText = await page.textContent('body');
console.log('body has entry after reload:', bodyText.includes('Проверка сохранения'));
const lsKeys2 = await page.evaluate(() => Object.keys(localStorage));
console.log('localStorage keys after reload:', lsKeys2);
if (dbKey) {
  const raw2 = await page.evaluate((k) => localStorage.getItem(k), dbKey);
  console.log('has entry in storage after reload:', raw2 ? raw2.includes('Проверка сохранения') : 'NO KEY');
}

await browser.close();
release();
