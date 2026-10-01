// Снимок одного экрана приложения клиента с действием: node qa/capp-shot.mjs <lang> <out.png> <route> [click-selector]
import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../scripts/pw-slots.mjs';
const [lang, out, route, click] = process.argv.slice(2);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
page.setDefaultTimeout(90000);
await page.goto(`http://localhost:3710${route}${route.includes('?') ? '&' : '?'}demo=client&lang=${lang}&empty=0`);
await page.addStyleTag({ content: '[data-demo-fab]{display:none !important}' });
if (click) { await page.locator(click).first().click(); }
await page.waitForTimeout(3500);
await page.screenshot({ path: out });
console.log(page.url());
await browser.close(); release();
