import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const OUT = '/Users/arsen/WebstormProjects/booking-platform/qa/full-test-0930/finance';
const release = await acquireBrowserSlot({ timeoutMs: 120 * 60_000 });
const browser = await chromium.launch({ headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 300)));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text().slice(0, 300)));
  const d = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  await page.goto(`http://localhost:3710/biz/journal?demo=owner&sphere=dental&lang=ru&empty=0`, { waitUntil: 'networkidle', timeout: 600000 });
  await page.goto(`http://localhost:3710/biz/journal?date=${d}&booking=bk_2430`, { waitUntil: 'networkidle', timeout: 600000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/probe-journal-phone.png` });
  console.log('TABS', JSON.stringify(await page.getByRole('tab').allInnerTexts()));
  console.log('TEXT', (await page.locator('body').innerText()).replace(/\s*\n\s*/g, ' | ').slice(0, 500));
} finally { await browser.close(); release(); console.log('DONE'); }
