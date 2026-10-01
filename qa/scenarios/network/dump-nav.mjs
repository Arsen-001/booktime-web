import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3710/biz/network/staff?demo=owner&sphere=nails&lang=ru&theme=light');
await page.waitForTimeout(1500);
const links = await page.$$eval('a[href^="/biz/network"]', els => els.map(e => ({ href: e.getAttribute('href'), text: e.textContent.trim() })));
console.log(JSON.stringify(links, null, 2));
await browser.close();
