import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/clients?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const txt = await page.locator('body').innerText();
  const phones = [...txt.matchAll(/\+374\d{8}/g)].map(m=>m[0]);
  console.log(JSON.stringify([...new Set(phones)].slice(0,10)));
} finally { await browser.close(); release(); }
