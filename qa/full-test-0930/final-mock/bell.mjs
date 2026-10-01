// Колокольчик кабинета после правки listStockBellAlerts: строки склада на месте
import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const warns = []; page.on('console', (m) => { if (m.type() !== 'log') warns.push(m.type() + ' ' + m.text().slice(0, 120)); });
await page.goto('http://localhost:3710/biz/staff?demo=owner&empty=0&lang=ru', { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForTimeout(3500);
await page.locator('header button:has(svg.lucide-bell), button[aria-label*="ведомлен"]').first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/final-mock/act/bell-after-fix.png' });
console.log((await page.getByRole('dialog').or(page.locator('[role="menu"]')).first().innerText().catch(() => 'no popup')).slice(0, 800));
console.log(warns.join('\n'));
await browser.close(); release();
