// Мастер без payroll.view: в меню «Моя зарплата», нет «Зарплата» раздела; /biz/payroll/me — только своя строка
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/backend-2';
const B = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
try {
  for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    page.setDefaultTimeout(90000);
    page.on('pageerror', (e) => log.push(`${name} pageerror ${String(e).slice(0, 150)}`));
    await page.goto(`${B}/biz/journal?demo=master&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')));
    log.push(`${name} меню: payroll/me=${hrefs.includes('/biz/payroll/me')} , /biz/payroll=${hrefs.includes('/biz/payroll')}`);
    await page.goto(`${B}/biz/payroll/me?demo=master&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    const main = await page.innerText('main').catch(() => page.innerText('body'));
    log.push(`${name} /biz/payroll/me: ${main.replace(/\s+/g, ' ').slice(0, 400)}`);
    await page.screenshot({ path: `${OUT}/master-payroll-me-${name}.png`, fullPage: true }).catch(() => {});
    await page.goto(`${B}/biz/payroll/period?demo=master&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    const per = await page.innerText('main').catch(() => page.innerText('body'));
    log.push(`${name} /biz/payroll/period: ${per.replace(/\s+/g, ' ').slice(0, 300)}`);
    await page.screenshot({ path: `${OUT}/master-payroll-period-${name}.png`, fullPage: true }).catch(() => {});
    await ctx.close();
  }
} catch (e) {
  log.push('ERR ' + String(e).slice(0, 300));
} finally {
  await browser.close();
  release();
  fs.writeFileSync(`${OUT}/master-payroll.log`, log.join('\n'));
  console.log(log.join('\n'));
}
