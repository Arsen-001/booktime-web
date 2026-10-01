// Решение 01.10: администратор без payroll.view видит только свою зарплату.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/payroll/ui';
const B = 'http://localhost:3710';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
const log = [];
try {
  for (const [device, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    page.setDefaultTimeout(90000);
    for (const r of ['/biz/payroll/period', '/biz/payroll/daily', '/biz/payroll/me']) {
      await page.goto(`${B}${r}?demo=admin&sphere=nails&lang=ru`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      const txt = await page.innerText('main').catch(() => '');
      const names = ['Лилит Мкртчян', 'Ани Саргсян', 'Мариам Петросян', 'Сона Григорян'].filter(n => txt.includes(n));
      log.push(`${device} ${r}: видны ${JSON.stringify(names)}`);
      await page.screenshot({ path: `${OUT}/admin-own${r.replace(/\//g, '_')}-${device}.png`, timeout: 90000 }).catch(() => {});
    }
  }
} catch (e) { log.push('ERR ' + String(e).slice(0, 200)); }
finally { await browser.close(); release(); fs.writeFileSync(`${OUT}/log3.txt`, log.join('\n')); console.log(log.join('\n')); }
