import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto('http://localhost:3710/biz/reports?demo=owner&empty=0&lang=ru&sphere=nails', { timeout: 180000 });
  await page.getByRole('button', { name: /^Фильтры/ }).click({ timeout: 90000 });
  await page.waitForTimeout(800);
  console.log('labels', await page.getByRole('combobox', { name: 'Должности' }).count(), await page.getByRole('combobox', { name: 'Сотрудники' }).count());
  await page.goto('http://localhost:3710/biz/reports?demo=owner&empty=0&lang=en&sphere=nails', { timeout: 180000 });
  await page.waitForFunction(() => /Booked value/.test(document.querySelector('main')?.innerText ?? ''), null, { timeout: 90000 }).catch(() => {});
  const t = await page.innerText('main');
  console.log('en', /Booked value[^\n]*/.exec(t)?.[0], '|', /\* Money[^\n]{0,60}/.exec(t)?.[0]);
  await page.screenshot({ path: '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/reports/v-dashboard-en.png', fullPage: true });
} finally { await browser.close(); release(); }
