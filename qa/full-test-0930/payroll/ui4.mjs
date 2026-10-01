// 01.10: пункт меню «Моя зарплата» у администратора; расчёт за период — только своя строка; у владельца — все.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/payroll/ui';
const B = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
try {
  for (const [device, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    page.setDefaultTimeout(90000);
    await page.goto(`${B}/biz/payroll/period?demo=admin&sphere=nails&lang=ru`, { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    if (device === 'phone') { await page.getByRole('button', { name: /меню/i }).first().click().catch(() => log.push('кнопку меню не нашёл')); await page.waitForTimeout(1200); }
    const link = page.getByRole('link', { name: 'Моя зарплата' });
    log.push(`${device}: пункт «Моя зарплата» в меню админа: ${await link.count()}`);
    await page.screenshot({ path: `${OUT}/admin-menu-${device}.png`, timeout: 90000 }).catch(() => {});
    if (await link.count()) {
      await link.first().click();
      await page.waitForURL(/payroll\/me/, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(2500);
      log.push(`${device}: после клика ${page.url().replace(B, '')}; заголовок: ${(await page.innerText('main')).split('\n')[0]}`);
      await page.screenshot({ path: `${OUT}/admin-me-from-menu-${device}.png`, timeout: 90000 }).catch(() => {});
    }
    for (const persona of ['admin', 'owner']) {
      await page.goto(`${B}/biz/payroll/period?demo=${persona}&sphere=nails&lang=ru`, { waitUntil: 'load' });
      await page.waitForTimeout(5000);
      const txt = await page.innerText('main').catch(() => '');
      log.push(`${device} ${persona} период: ${['Лилит Мкртчян', 'Ани Саргсян', 'Мариам Петросян'].filter(n => txt.includes(n)).join(', ')}`);
    }
  }
} catch (e) { log.push('ERR ' + String(e).slice(0, 200)); }
finally { await browser.close(); release(); fs.writeFileSync(`${OUT}/log4.txt`, log.join('\n')); console.log(log.join('\n')); }
