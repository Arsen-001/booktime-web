import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, locale:'ru-RU', timezoneId:'Asia/Yerevan' });
const p = await ctx.newPage();
await p.goto('http://localhost:3710/biz/schedule?demo=owner&sphere=nails&lang=ru&theme=light', { timeout: 180000 });
await p.locator('table').first().waitFor({ timeout: 120000 });
await p.waitForTimeout(2000);
const iw = () => p.evaluate(() => innerWidth);
console.log('start', await iw());
const tries = [
  ['hide sr-only spans in cells', () => document.querySelectorAll('table .sr-only').forEach((e) => (e.style.display = 'none'))],
  ['hide thead', () => (document.querySelector('table thead').style.display = 'none')],
  ['hide table wrapper', () => (document.querySelector('.overflow-x-auto').style.display = 'none')],
];
for (const [name, fn] of tries) { await p.evaluate(fn); await p.waitForTimeout(500); console.log(name, await iw()); }
await b.close();
