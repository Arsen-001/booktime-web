import { chromium } from '@playwright/test';
import { acquireBrowserSlot } from '../../../../scripts/pw-slots.mjs';
const release = await acquireBrowserSlot();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3710/biz/loyalty?demo=owner&empty=0&sphere=nails&lang=ru&theme=light', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const data = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    const out = {};
    for (const k of keys) {
      if (/loyalty|client/i.test(k)) {
        try { out[k] = JSON.parse(localStorage.getItem(k)).length ?? 'obj'; } catch { out[k] = 'parseerr'; }
      }
    }
    return { keys: keys.filter(k=>/loyalty|client/i.test(k)) };
  });
  console.log(JSON.stringify(data));
} finally { await browser.close(); release(); }
