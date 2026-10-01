import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../scripts/pw-slots.mjs';

const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3710/b/nuri-nail-studio?lang=en', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const text = await page.locator('body').innerText();
console.log('has RU words:', /Записаться|Услуги|Мастера/.test(text));
console.log('has EN words:', /Book|Services|Masters/i.test(text));
const cookies = await ctx.cookies();
console.log('cookie lang:', cookies.find((c) => c.name === 'lang')?.value);
await page.screenshot({ path: 'qa/shots/online/g1-2-m1/lang-en/verify.png' });
await browser.close();
release();
