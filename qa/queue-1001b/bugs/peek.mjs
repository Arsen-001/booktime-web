import { chromium } from 'playwright';
import { acquireBrowserSlot } from '/Users/arsen/WebstormProjects/booking-platform/scripts/pw-slots.mjs';
const [path, persona, shot] = process.argv.slice(2);
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message.slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 300)); });
  await page.goto(`http://localhost:3710${path}${path.includes('?') ? '&' : '?'}demo=${persona}&data=mock`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForTimeout(6000);
  console.log((await page.locator('main').innerText().catch(() => page.locator('body').innerText())).slice(0, 2500));
  if (shot) await page.screenshot({ path: shot, fullPage: false });
} finally { await browser.close(); release(); }
